import express from 'express';
import authenticateToken from '../middleware/authMiddleware.js';
import Payment from '../models/payment.model.js';
import mysql from 'mysql2/promise';
import config from '../config/database.js';

const router = express.Router();

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
router.post('/proof', authenticateToken, async (req, res) => {
    try {
        const { studentId, amount, paymentDate, proofImage, description } = req.body;

        // Validate required fields
        if (!studentId || !amount || !paymentDate || !proofImage) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields. Please provide studentId, amount, paymentDate, and proofImage'
            });
        }

        // Create new payment proof
        const paymentData = {
            student_id: studentId,
            amount,
            payment_date: new Date(paymentDate),
            proof_image: proofImage,
            description,
            submitted_by: req.user.id // from authenticateToken middleware
        };

        // Save to database
        const payment = await Payment.create(paymentData);

        res.status(201).json({
            success: true,
            message: 'Payment proof submitted successfully',
            data: {
                paymentId: payment._id,
                status: payment.status
            }
        });
    } catch (error) {
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
