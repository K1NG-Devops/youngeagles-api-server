import express from 'express';
import authenticateToken from '../middleware/authMiddleware.js';
import Payment from '../models/payment.model.js';
import mysql from 'mysql2/promise';
import config from '../config/database.js';
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
    const connection = await mysql.createConnection(config);
    try {
        const [rows] = await connection.execute(sql, params);
        return rows;
    } finally {
        await connection.end();
    }
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

    } catch (error) {
        console.error('Error submitting payment proof:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting payment proof',
            error: error.message
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

    } catch (error) {
        console.error('Error fetching payment proofs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment proofs',
            error: error.message
        });
    }
});

// Get all payment proofs (admin only)
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

    } catch (error) {
        console.error('Error fetching payment proofs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment proofs',
            error: error.message
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

    } catch (error) {
        console.error('Error reviewing payment proof:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to review payment proof',
            error: error.message
        });
    }
});

export default router;
