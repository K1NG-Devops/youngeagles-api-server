import express from 'express';
import crypto from 'crypto';
import payfastService from '../services/payfastService.js';
import { query } from '../db.js';

const router = express.Router();

// Helper function to log payment events
async function logPaymentEvent(event_type, data) {
    try {
        await query(
            'INSERT INTO payment_logs (event_type, data, created_at) VALUES (?, ?, NOW())',
            [event_type, JSON.stringify(data)]
        );
    } catch (error) {
        console.error('Error logging payment event:', error);
    }
}

// Payment Success - User is redirected here after successful payment
router.get('/payment/success', async (req, res) => {
    try {
        console.log('🎉 Payment Success Callback received');
        
        // In production, you might want to verify the payment_id
        const { payment_id } = req.query;
        
        // Log the success event
        await logPaymentEvent('payment_success_redirect', req.query);
        
        // Return a success HTML page
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payment Successful - Young Eagles</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        background-color: #f5f5f5;
                    }
                    .container {
                        text-align: center;
                        padding: 40px;
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        max-width: 500px;
                    }
                    .success-icon {
                        font-size: 80px;
                        color: #4CAF50;
                        margin-bottom: 20px;
                    }
                    h1 {
                        color: #333;
                        margin-bottom: 10px;
                    }
                    p {
                        color: #666;
                        line-height: 1.6;
                        margin-bottom: 30px;
                    }
                    .button {
                        display: inline-block;
                        padding: 12px 30px;
                        background-color: #4CAF50;
                        color: white;
                        text-decoration: none;
                        border-radius: 4px;
                        transition: background-color 0.3s;
                    }
                    .button:hover {
                        background-color: #45a049;
                    }
                    .payment-id {
                        margin-top: 20px;
                        font-size: 14px;
                        color: #999;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="success-icon">✓</div>
                    <h1>Payment Successful!</h1>
                    <p>
                        Thank you for your payment. Your subscription has been activated successfully.
                        You will receive a confirmation email shortly.
                    </p>
                    <a href="/" class="button">Return to Dashboard</a>
                    ${payment_id ? `<p class="payment-id">Payment ID: ${payment_id}</p>` : ''}
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error handling payment success:', error);
        res.status(500).send('An error occurred processing your payment confirmation.');
    }
});

// Payment Cancelled - User is redirected here if they cancel payment
router.get('/payment/cancel', async (req, res) => {
    try {
        console.log('❌ Payment Cancel Callback received');
        
        // Log the cancel event
        await logPaymentEvent('payment_cancelled', req.query);
        
        // Return a cancellation HTML page
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payment Cancelled - Young Eagles</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        background-color: #f5f5f5;
                    }
                    .container {
                        text-align: center;
                        padding: 40px;
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        max-width: 500px;
                    }
                    .cancel-icon {
                        font-size: 80px;
                        color: #ff9800;
                        margin-bottom: 20px;
                    }
                    h1 {
                        color: #333;
                        margin-bottom: 10px;
                    }
                    p {
                        color: #666;
                        line-height: 1.6;
                        margin-bottom: 30px;
                    }
                    .button-group {
                        display: flex;
                        gap: 15px;
                        justify-content: center;
                    }
                    .button {
                        display: inline-block;
                        padding: 12px 30px;
                        text-decoration: none;
                        border-radius: 4px;
                        transition: all 0.3s;
                    }
                    .primary-button {
                        background-color: #4CAF50;
                        color: white;
                    }
                    .primary-button:hover {
                        background-color: #45a049;
                    }
                    .secondary-button {
                        background-color: #f5f5f5;
                        color: #333;
                        border: 1px solid #ddd;
                    }
                    .secondary-button:hover {
                        background-color: #e0e0e0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="cancel-icon">⚠</div>
                    <h1>Payment Cancelled</h1>
                    <p>
                        Your payment was cancelled. No charges have been made to your account.
                        You can retry the payment at any time.
                    </p>
                    <div class="button-group">
                        <a href="/payment/retry" class="button primary-button">Retry Payment</a>
                        <a href="/" class="button secondary-button">Back to Dashboard</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error handling payment cancellation:', error);
        res.status(500).send('An error occurred processing your cancellation.');
    }
});

// PayFast ITN (Instant Transaction Notification) - Called by PayFast servers
router.post('/api/payments/notify', async (req, res) => {
    try {
        console.log('📨 PayFast ITN received:', req.body);
        
        // PayFast sends data as form-encoded
        const pfData = req.body;
        
        // Log the notification
        await logPaymentEvent('payfast_itn', pfData);
        
        // Verify the payment with PayFast service
        const verificationResult = await payfastService.verifyPayment(pfData);
        
        if (!verificationResult.success) {
            console.error('❌ PayFast verification failed:', verificationResult.error);
            // PayFast expects a 200 response even on verification failure
            res.status(200).send('FAILED');
            return;
        }
        
        console.log('✅ PayFast payment verified:', verificationResult);
        
        // Extract payment details
        const {
            payment_id,
            status,
            amount,
            subscription_id,
            user_id,
            item_name
        } = verificationResult;
        
        // Update payment status in database based on PayFast status
        if (status === 'COMPLETE') {
            // Update subscription status
            if (subscription_id) {
                await query(
                    `UPDATE subscriptions 
                     SET status = 'active', 
                         last_payment_date = NOW(),
                         next_billing_date = DATE_ADD(NOW(), INTERVAL 1 MONTH),
                         updated_at = NOW()
                     WHERE id = ?`,
                    [subscription_id]
                );
                
                console.log(`✅ Subscription ${subscription_id} activated`);
            }
            
            // Record the transaction
            await query(
                `INSERT INTO subscription_transactions 
                 (subscription_id, amount, status, payment_method, 
                  gateway_transaction_id, gateway_response, created_at)
                 VALUES (?, ?, 'completed', 'payfast', ?, ?, NOW())`,
                [subscription_id, amount, payment_id, JSON.stringify(pfData)]
            );
            
            // Update user payment status if needed
            if (user_id) {
                await query(
                    `UPDATE users 
                     SET payment_status = 'paid', 
                         last_payment_date = NOW() 
                     WHERE id = ?`,
                    [user_id]
                );
            }
            
            console.log('✅ Payment processed successfully');
        } else if (status === 'CANCELLED') {
            // Handle cancelled payment
            console.log('⚠️ Payment was cancelled');
            
            if (subscription_id) {
                await query(
                    `UPDATE subscriptions 
                     SET status = 'pending' 
                     WHERE id = ?`,
                    [subscription_id]
                );
            }
        }
        
        // PayFast expects a 200 OK response
        res.status(200).send('OK');
        
    } catch (error) {
        console.error('❌ Error processing PayFast ITN:', error);
        // PayFast will retry if we don't respond with 200
        res.status(200).send('ERROR');
    }
});

// Verify PayFast IPN origin (security check)
router.use('/api/payments/notify', (req, res, next) => {
    // In production, verify the request is from PayFast
    if (process.env.NODE_ENV === 'production') {
        const isValidIP = payfastService.validateWebhookIP(req);
        if (!isValidIP) {
            console.warn('⚠️ Invalid PayFast IPN source IP:', req.ip);
            return res.status(403).send('Forbidden');
        }
    }
    next();
});

// Manual payment status check endpoint
router.get('/api/payments/status/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        
        // Query payment status from database
        const [payment] = await query(
            `SELECT st.*, s.user_id, s.plan_id 
             FROM subscription_transactions st
             LEFT JOIN subscriptions s ON st.subscription_id = s.id
             WHERE st.gateway_transaction_id = ?`,
            [paymentId]
        );
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Payment not found'
            });
        }
        
        res.json({
            success: true,
            payment: {
                id: payment.id,
                status: payment.status,
                amount: payment.amount,
                created_at: payment.created_at,
                subscription_id: payment.subscription_id,
                user_id: payment.user_id
            }
        });
        
    } catch (error) {
        console.error('Error checking payment status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check payment status'
        });
    }
});

export default router;
