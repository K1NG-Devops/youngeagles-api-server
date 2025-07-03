import express from 'express';
import authenticateToken from '../middleware/authMiddleware.js';
import Payment from '../models/payment.model.js';

const router = express.Router();

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

export default router;
