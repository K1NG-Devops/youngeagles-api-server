import express from 'express';
import authenticateToken from '../middleware/authMiddleware.js';
import Payment from '../models/payment.model.js';
import { db } from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(process.cwd(), 'uploads', 'payment_proofs');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'payment-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images (JPG, PNG, GIF) and PDF files are allowed.'));
        }
    }
});

// Helper function to execute database queries
async function executeQuery(sql, params = []) {
    const [rows] = await db.execute(sql, params);
    return rows;
}

// Route for payment proof submission
router.post('/proof', authenticateToken, upload.single('proof_file'), async (req, res) => {
    try {
        // Handle both old and new field names for backward compatibility
        const child_id = req.body.child_id || req.body.studentId;
        const amount = req.body.amount;
        const payment_date = req.body.payment_date || req.body.paymentDate;
        const payment_method = req.body.payment_method || 'bank_transfer';
        const reference_number = req.body.reference_number;

        // Validate required fields
        if (!child_id || !amount || !payment_date) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields. Please provide child_id, amount, and payment_date'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Payment proof file is required'
            });
        }

        // Try to save to payment_proofs table first (newer schema)
        try {
            const file_url = `/uploads/payment_proofs/${req.file.filename}`;
            
            const result = await executeQuery(`
                INSERT INTO payment_proofs (
                    parent_id, child_id, amount, file_url, payment_date,
                    reference_number, payment_method, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())
            `, [
                req.user.id,
                child_id,
                amount,
                file_url,
                payment_date,
                reference_number,
                payment_method
            ]);

            return res.status(201).json({
                success: true,
                message: 'Payment proof submitted successfully',
                data: {
                    paymentId: result.insertId,
                    status: 'pending'
                }
            });
        } catch (error) {
            console.log('payment_proofs table not found, trying payments table');
        }

        // Fallback to payments table (older schema)
        const paymentData = {
            student_id: child_id,
            amount,
            payment_date: new Date(payment_date),
            proof_image: req.file.filename,
            description: reference_number || `Payment for child ${child_id}`,
            submitted_by: req.user.id
        };

        const payment = await Payment.create(paymentData);

        res.status(201).json({
            success: true,
            message: 'Payment proof submitted successfully',
            data: {
                paymentId: payment.id,
                status: payment.status || 'pending'
            }
        });

    } catch (_error) {
        console.error('Error submitting payment proof:', _error);
        res.status(500).json({
            success: false,
            message: 'Error submitting payment proof',
            error: _error.message
        });
    }
});

// Get parent's payment proofs
router.get('/proofs/parent', authenticateToken, async (req, res) => {
    try {
        const parent_id = req.user.id;
        
        // First try the payment_proofs table (newer schema)
        try {
            const proofs = await executeQuery(`
                SELECT 
                    p.*,
                    c.name as child_name,
                    s.name as reviewed_by_name
                FROM payment_proofs p
                LEFT JOIN children c ON p.child_id = c.id
                LEFT JOIN staff s ON p.reviewed_by = s.id
                WHERE p.parent_id = ?
                ORDER BY p.created_at DESC
            `, [parent_id]);
            
            return res.json({
                success: true,
                proofs
            });
        } catch (error) {
            // If payment_proofs table doesn't exist, try payments table
            console.log('payment_proofs table not found, trying payments table');
        }
        
        // Fallback to payments table (older schema)
        const proofs = await executeQuery(`
            SELECT 
                p.*,
                c.name as child_name,
                'pending' as status
            FROM payments p
            LEFT JOIN children c ON p.student_id = c.id
            WHERE p.submitted_by = ?
            ORDER BY p.created_at DESC
        `, [parent_id]);

        res.json({
            success: true,
            proofs
        });

    } catch (_error) {
        console.error('Error fetching payment proofs:', _error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment proofs',
            error: _error.message
        });
    }
});

// Delete rejected payment proof (parents can delete their own, admins can delete any)
router.delete('/proofs/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;
        const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin';

        let result;
        
        if (isAdmin) {
            // Admins can delete any rejected proof
            result = await executeQuery(`
                DELETE FROM payment_proofs 
                WHERE id = ? AND status = 'rejected'
            `, [id]);
        } else {
            // Parents can only delete their own rejected proofs
            result = await executeQuery(`
                DELETE FROM payment_proofs 
                WHERE id = ? AND parent_id = ? AND status = 'rejected'
            `, [id, user_id]);
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Rejected payment proof not found or cannot be deleted'
            });
        }

        res.json({
            success: true,
            message: 'Rejected payment proof deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting rejected payment proof:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete rejected payment proof',
            error: error.message
        });
    }
});

router.get('/proofs/admin', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can access all payment proofs'
            });
        }

        // First try the payment_proofs table (newer schema)
        try {
            const proofs = await executeQuery(`
                SELECT 
                    p.*,
                    u.name as parent_name,
                    c.name as child_name,
                    s.name as reviewed_by_name
                FROM payment_proofs p
                LEFT JOIN users u ON p.parent_id = u.id
                LEFT JOIN children c ON p.child_id = c.id
                LEFT JOIN staff s ON p.reviewed_by = s.id
                ORDER BY p.created_at DESC
            `);
            
            return res.json({
                success: true,
                proofs
            });
        } catch (error) {
            console.log('payment_proofs table not found, trying payments table');
        }

        // Fallback to payments table (older schema)
        const proofs = await executeQuery(`
            SELECT 
                p.*,
                u.name as parent_name,
                c.name as child_name,
                'pending' as status
            FROM payments p
            LEFT JOIN users u ON p.submitted_by = u.id
            LEFT JOIN children c ON p.student_id = c.id
            ORDER BY p.created_at DESC
        `);

        res.json({
            success: true,
            proofs
        });

    } catch (_error) {
        console.error('Error fetching payment proofs:', _error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment proofs',
            error: _error.message
        });
    }
});

// Review payment proof (admin only)
router.post('/proofs/:id/review', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can review payment proofs'
            });
        }

        const { id } = req.params;
        const { status, admin_notes } = req.body;

        // First try updating payment_proofs table
        try {
            await executeQuery(`
                UPDATE payment_proofs 
                SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = NOW()
                WHERE id = ?
            `, [status, admin_notes, req.user.id, id]);
        } catch (error) {
            // Fallback to payments table
            await executeQuery(`
                UPDATE payments 
                SET status = ?, verification_date = NOW(), verified_by = ?
                WHERE id = ?
            `, [status === 'approved' ? 'verified' : 'rejected', req.user.id, id]);
        }

        res.json({
            success: true,
            message: `Payment proof ${status} successfully`
        });

    } catch (_error) {
        console.error('Error reviewing payment proof:', _error);
        res.status(500).json({
            success: false,
            message: 'Failed to review payment proof',
            error: _error.message
        });
    }
});

// Get payment summary for parent (total paid amount from approved payments only)
router.get('/summary/parent', authenticateToken, async (req, res) => {
    try {
        const parent_id = req.user.id;
        
        // First try the payment_proofs table (newer schema)
        try {
            const result = await executeQuery(`
                SELECT 
                    COALESCE(SUM(amount), 0) as total_paid,
                    COUNT(*) as total_approved_payments
                FROM payment_proofs 
                WHERE parent_id = ? AND status = 'approved'
            `, [parent_id]);
            
            const [allPayments] = await executeQuery(`
                SELECT 
                    COUNT(*) as total_payments,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
                    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_payments
                FROM payment_proofs 
                WHERE parent_id = ?
            `, [parent_id]);
            
            return res.json({
                success: true,
                summary: {
                    total_paid: parseFloat(result[0].total_paid) || 0,
                    total_approved_payments: result[0].total_approved_payments || 0,
                    total_payments: allPayments.total_payments || 0,
                    pending_payments: allPayments.pending_payments || 0,
                    rejected_payments: allPayments.rejected_payments || 0
                }
            });
        } catch (error) {
            console.log('payment_proofs table not found, trying payments table');
        }
        
        // Fallback to payments table (older schema)
        const result = await executeQuery(`
            SELECT 
                COALESCE(SUM(amount), 0) as total_paid,
                COUNT(*) as total_payments
            FROM payments 
            WHERE submitted_by = ? AND (status = 'verified' OR status = 'approved')
        `, [parent_id]);
        
        res.json({
            success: true,
            summary: {
                total_paid: parseFloat(result[0].total_paid) || 0,
                total_approved_payments: result[0].total_payments || 0,
                total_payments: result[0].total_payments || 0,
                pending_payments: 0,
                rejected_payments: 0
            }
        });
        
    } catch (_error) {
        console.error('Error fetching payment summary:', _error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment summary',
            error: _error.message
        });
    }
});

// Get comprehensive admin dashboard data (parents, children, and payment status)
router.get('/admin/dashboard', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can access dashboard data'
            });
        }

        // Get comprehensive parent-child-payment data
        const parentsWithChildren = await executeQuery(`
            SELECT 
                u.id as parent_id,
                u.name as parent_name,
                u.email as parent_email,
                u.phone as parent_phone,
                u.created_at as parent_registered_date,
                COUNT(DISTINCT c.id) as total_children,
                GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') as children_names,
                GROUP_CONCAT(DISTINCT c.id ORDER BY c.name SEPARATOR ',') as children_ids,
                COALESCE(SUM(CASE WHEN pp.status = 'pending' THEN pp.amount ELSE 0 END), 0) as pending_amount,
                COALESCE(SUM(CASE WHEN pp.status = 'approved' THEN pp.amount ELSE 0 END), 0) as approved_amount,
                COALESCE(SUM(CASE WHEN pp.status = 'rejected' THEN pp.amount ELSE 0 END), 0) as rejected_amount,
                COUNT(CASE WHEN pp.status = 'pending' THEN 1 END) as pending_payments_count,
                COUNT(CASE WHEN pp.status = 'approved' THEN 1 END) as approved_payments_count,
                COUNT(CASE WHEN pp.status = 'rejected' THEN 1 END) as rejected_payments_count,
                MAX(pp.created_at) as last_payment_date
            FROM users u
            LEFT JOIN children c ON u.id = c.parent_id
            LEFT JOIN payment_proofs pp ON u.id = pp.parent_id
            WHERE u.role = 'parent' AND u.is_active = 1
            GROUP BY u.id, u.name, u.email, u.phone, u.created_at
            ORDER BY pending_amount DESC, u.name ASC
        `);

        // Get recent payment activity (last 30 days)
        const recentActivity = await executeQuery(`
            SELECT 
                pp.id,
                pp.amount,
                pp.payment_date,
                pp.status,
                pp.created_at,
                pp.reviewed_at,
                u.name as parent_name,
                c.name as child_name,
                s.name as reviewed_by_name
            FROM payment_proofs pp
            LEFT JOIN users u ON pp.parent_id = u.id
            LEFT JOIN children c ON pp.child_id = c.id
            LEFT JOIN staff s ON pp.reviewed_by = s.id
            WHERE pp.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ORDER BY pp.created_at DESC
            LIMIT 50
        `);

        // Get overall statistics
        const [stats] = await executeQuery(`
            SELECT 
                COUNT(DISTINCT u.id) as total_active_parents,
                COUNT(DISTINCT c.id) as total_active_children,
                COUNT(CASE WHEN pp.status = 'pending' THEN 1 END) as total_pending_payments,
                COUNT(CASE WHEN pp.status = 'approved' THEN 1 END) as total_approved_payments,
                COUNT(CASE WHEN pp.status = 'rejected' THEN 1 END) as total_rejected_payments,
                COALESCE(SUM(CASE WHEN pp.status = 'pending' THEN pp.amount ELSE 0 END), 0) as total_pending_amount,
                COALESCE(SUM(CASE WHEN pp.status = 'approved' THEN pp.amount ELSE 0 END), 0) as total_approved_amount,
                COALESCE(SUM(CASE WHEN pp.status = 'rejected' THEN pp.amount ELSE 0 END), 0) as total_rejected_amount
            FROM users u
            LEFT JOIN children c ON u.id = c.parent_id AND c.is_active = 1
            LEFT JOIN payment_proofs pp ON u.id = pp.parent_id
            WHERE u.role = 'parent' AND u.is_active = 1
        `);

        // Get parents with only pending payments (priority for follow-up)
        const priorityParents = parentsWithChildren.filter(parent => 
            parent.pending_amount > 0 && parent.approved_amount === 0
        );

        // Get parents with no payment submissions
        const parentsWithoutPayments = parentsWithChildren.filter(parent => 
            parent.pending_payments_count === 0 && 
            parent.approved_payments_count === 0 && 
            parent.rejected_payments_count === 0
        );

        return res.json({
            success: true,
            dashboard: {
                overview: {
                    total_active_parents: stats.total_active_parents,
                    total_active_children: stats.total_active_children,
                    total_pending_payments: stats.total_pending_payments,
                    total_approved_payments: stats.total_approved_payments,
                    total_rejected_payments: stats.total_rejected_payments,
                    total_pending_amount: parseFloat(stats.total_pending_amount),
                    total_approved_amount: parseFloat(stats.total_approved_amount),
                    total_rejected_amount: parseFloat(stats.total_rejected_amount)
                },
                parents_with_children: parentsWithChildren.map(parent => ({
                    ...parent,
                    pending_amount: parseFloat(parent.pending_amount),
                    approved_amount: parseFloat(parent.approved_amount),
                    rejected_amount: parseFloat(parent.rejected_amount),
                    children_ids: parent.children_ids ? parent.children_ids.split(',').map(id => parseInt(id)) : []
                })),
                priority_parents: priorityParents.length,
                parents_without_payments: parentsWithoutPayments.length,
                recent_activity: recentActivity
            }
        });

    } catch (_error) {
        console.error('Error fetching admin dashboard data:', _error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch admin dashboard data',
            error: _error.message
        });
    }
});

// Get detailed parent payment information
router.get('/admin/parent/:parentId/details', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can access parent details'
            });
        }

        const { parentId } = req.params;

        // Get parent details with children
        const [parentInfo] = await executeQuery(`
            SELECT 
                u.id,
                u.name,
                u.email,
                u.phone,
                u.address,
                u.created_at as registered_date,
                u.last_login,
                COUNT(DISTINCT c.id) as total_children
            FROM users u
            LEFT JOIN children c ON u.id = c.parent_id AND c.is_active = 1
            WHERE u.id = ? AND u.role = 'parent' AND u.is_active = 1
            GROUP BY u.id
        `, [parentId]);

        if (!parentInfo) {
            return res.status(404).json({
                success: false,
                message: 'Parent not found'
            });
        }

        // Get children details
        const children = await executeQuery(`
            SELECT 
                id,
                name,
                age,
                grade,
                className,
                enrollment_date,
                is_active
            FROM children
            WHERE parent_id = ? AND is_active = 1
            ORDER BY name ASC
        `, [parentId]);

        // Get all payment proofs for this parent
        const paymentHistory = await executeQuery(`
            SELECT 
                pp.id,
                pp.amount,
                pp.payment_date,
                pp.payment_method,
                pp.reference_number,
                pp.status,
                pp.admin_notes,
                pp.created_at,
                pp.reviewed_at,
                c.name as child_name,
                s.name as reviewed_by_name
            FROM payment_proofs pp
            LEFT JOIN children c ON pp.child_id = c.id
            LEFT JOIN staff s ON pp.reviewed_by = s.id
            WHERE pp.parent_id = ?
            ORDER BY pp.created_at DESC
        `, [parentId]);

        // Calculate payment summary
        const paymentSummary = {
            total_payments: paymentHistory.length,
            pending_payments: paymentHistory.filter(p => p.status === 'pending').length,
            approved_payments: paymentHistory.filter(p => p.status === 'approved').length,
            rejected_payments: paymentHistory.filter(p => p.status === 'rejected').length,
            total_pending_amount: paymentHistory
                .filter(p => p.status === 'pending')
                .reduce((sum, p) => sum + parseFloat(p.amount), 0),
            total_approved_amount: paymentHistory
                .filter(p => p.status === 'approved')
                .reduce((sum, p) => sum + parseFloat(p.amount), 0),
            total_rejected_amount: paymentHistory
                .filter(p => p.status === 'rejected')
                .reduce((sum, p) => sum + parseFloat(p.amount), 0)
        };

        res.json({
            success: true,
            parent: parentInfo,
            children,
            payment_summary: paymentSummary,
            payment_history: paymentHistory
        });

    } catch (_error) {
        console.error('Error fetching parent details:', _error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch parent details',
            error: _error.message
        });
    }
});

// Get payment summary for admin (total from all approved payments)
router.get('/summary/admin', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.userType !== 'admin') {
res.status(403).json({
                success: false,
                message: 'Only admins can access payment summaries'
            });
        }
        
        // First try the payment_proofs table (newer schema)
        try {
            const result = await executeQuery(`
                SELECT 
                    COALESCE(SUM(amount), 0) as total_paid,
                    COUNT(*) as total_approved_payments
                FROM payment_proofs 
                WHERE status = 'approved'
            `);
            
            const [allPayments] = await executeQuery(`
                SELECT 
                    COUNT(*) as total_payments,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
                    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_payments
                FROM payment_proofs
            `);
            
            return res.json({
                success: true,
                summary: {
                    total_paid: parseFloat(result[0].total_paid) || 0,
                    total_approved_payments: result[0].total_approved_payments || 0,
                    total_payments: allPayments.total_payments || 0,
                    pending_payments: allPayments.pending_payments || 0,
                    rejected_payments: allPayments.rejected_payments || 0
                }
            });
        } catch (error) {
            console.log('payment_proofs table not found, trying payments table');
        }
        
        // Fallback to payments table (older schema)
        const result = await executeQuery(`
            SELECT 
                COALESCE(SUM(amount), 0) as total_paid,
                COUNT(*) as total_payments
            FROM payments 
            WHERE status = 'verified' OR status = 'approved'
        `);
        
        res.json({
            success: true,
            summary: {
                total_paid: parseFloat(result[0].total_paid) || 0,
                total_approved_payments: result[0].total_payments || 0,
                total_payments: result[0].total_payments || 0,
                pending_payments: 0,
                rejected_payments: 0
            }
        });
        
    } catch (_error) {
        console.error('Error fetching admin payment summary:', _error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment summary',
            error: _error.message
        });
    }
});

export default router;
