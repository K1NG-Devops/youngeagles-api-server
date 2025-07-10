import express from 'express';
import payfastService from '../services/payfastService.js';
import stripeService from '../services/stripeService.js';
import Subscription from '../models/Subscription.js';
import SubscriptionTransaction from '../models/SubscriptionTransaction.js';

const router = express.Router();

// PayFast webhook handler
router.post('/payfast', async (req, res) => {
    try {
        console.log('PayFast webhook received:', req.body);
        
        // Verify webhook IP for security
        if (!payfastService.validateWebhookIP(req)) {
            console.error('Invalid PayFast webhook IP:', req.ip);
            return res.status(403).json({ error: 'Invalid IP' });
        }

        // Verify payment
        const verification = await payfastService.verifyPayment(req.body);
        
        if (!verification.success || !verification.verified) {
            console.error('PayFast payment verification failed:', verification);
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        const {
            payment_id,
            merchant_payment_id,
            status,
            amount,
            subscription_id,
            user_id
        } = verification;

        console.log('PayFast payment verified:', {
            payment_id,
            merchant_payment_id,
            status,
            amount,
            subscription_id,
            user_id
        });

        // Find the subscription
        const subscription = await Subscription.findById(subscription_id);
        if (!subscription) {
            console.error('Subscription not found:', subscription_id);
            return res.status(404).json({ error: 'Subscription not found' });
        }

        // Find the transaction
        const transaction = await SubscriptionTransaction.findByTransactionId(
            merchant_payment_id, 
            'payfast'
        );

        if (!transaction) {
            console.error('Transaction not found:', merchant_payment_id);
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Update transaction status
        await SubscriptionTransaction.updateStatus(
            transaction.id,
            status === 'COMPLETE' ? 'completed' : 'failed',
            verification.raw_data
        );

        // Update subscription status based on payment result
        if (status === 'COMPLETE') {
            // Payment successful - activate subscription
            await Subscription.updateStatus(subscription_id, 'active');
            
            console.log('Subscription activated:', subscription_id);
            
            // Send success notification (if needed)
            // await notificationService.sendSubscriptionActivated(user_id, subscription);
            
        } else {
            // Payment failed - mark subscription as failed
            await Subscription.updateStatus(subscription_id, 'cancelled');
            
            console.log('Subscription cancelled due to payment failure:', subscription_id);
            
            // Send failure notification (if needed)
            // await notificationService.sendPaymentFailed(user_id, subscription);
        }

        // Respond to PayFast
        res.status(200).json({ success: true });

    } catch (error) {
        console.error('PayFast webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Stripe webhook handler
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.headers['stripe-signature'];
        
        if (!signature) {
            console.error('Missing Stripe signature');
            return res.status(400).json({ error: 'Missing signature' });
        }

        console.log('Stripe webhook received');

        // Process webhook
        const webhookResult = await stripeService.processWebhook(req.body, signature);
        
        if (!webhookResult.success) {
            console.error('Stripe webhook processing failed:', webhookResult);
            return res.status(400).json({ error: 'Webhook processing failed' });
        }

        const { event } = webhookResult;
        console.log('Stripe webhook event:', event.type);

        switch (event.type) {
            case 'payment_intent.succeeded':
                await handleStripePaymentSucceeded(event.data.object);
                break;

            case 'payment_intent.payment_failed':
                await handleStripePaymentFailed(event.data.object);
                break;

            case 'invoice.payment_succeeded':
                await handleStripeInvoicePaymentSucceeded(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handleStripeInvoicePaymentFailed(event.data.object);
                break;

            case 'customer.subscription.created':
                await handleStripeSubscriptionCreated(event.data.object);
                break;

            case 'customer.subscription.updated':
                await handleStripeSubscriptionUpdated(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleStripeSubscriptionDeleted(event.data.object);
                break;

            case 'customer.subscription.trial_will_end':
                await handleStripeTrialWillEnd(event.data.object);
                break;

            default:
                console.log(`Unhandled Stripe webhook event: ${event.type}`);
        }

        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Stripe webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Stripe webhook handlers
async function handleStripePaymentSucceeded(paymentIntent) {
    try {
        console.log('Stripe payment succeeded:', paymentIntent.id);
        
        const { subscription_id, user_id } = paymentIntent.metadata;
        
        if (!subscription_id || !user_id) {
            console.error('Missing metadata in payment intent:', paymentIntent.metadata);
            return;
        }

        // Find and update transaction
        const transaction = await SubscriptionTransaction.findByTransactionId(
            paymentIntent.id,
            'stripe'
        );

        if (transaction) {
            await SubscriptionTransaction.updateStatus(
                transaction.id,
                'completed',
                paymentIntent
            );
        }

        // Update subscription status
        await Subscription.updateStatus(subscription_id, 'active');
        
        console.log('Subscription activated via Stripe:', subscription_id);

    } catch (error) {
        console.error('Error handling Stripe payment succeeded:', error);
    }
}

async function handleStripePaymentFailed(paymentIntent) {
    try {
        console.log('Stripe payment failed:', paymentIntent.id);
        
        const { subscription_id, user_id } = paymentIntent.metadata;
        
        if (!subscription_id || !user_id) {
            console.error('Missing metadata in payment intent:', paymentIntent.metadata);
            return;
        }

        // Find and update transaction
        const transaction = await SubscriptionTransaction.findByTransactionId(
            paymentIntent.id,
            'stripe'
        );

        if (transaction) {
            await SubscriptionTransaction.updateStatus(
                transaction.id,
                'failed',
                paymentIntent
            );
        }

        // Update subscription status
        await Subscription.updateStatus(subscription_id, 'cancelled');
        
        console.log('Subscription cancelled due to Stripe payment failure:', subscription_id);

    } catch (error) {
        console.error('Error handling Stripe payment failed:', error);
    }
}

async function handleStripeInvoicePaymentSucceeded(invoice) {
    try {
        console.log('Stripe invoice payment succeeded:', invoice.id);
        
        const subscriptionId = invoice.subscription;
        if (!subscriptionId) return;

        // Find subscription by Stripe subscription ID
        const subscription = await Subscription.findByPaymentGatewayId(subscriptionId);
        
        if (subscription) {
            // Update next billing date
            const nextBillingDate = new Date(invoice.period_end * 1000);
            await Subscription.updateNextBillingDate(subscription.id, nextBillingDate);
            
            // Create transaction record
            const transactionData = {
                subscription_id: subscription.id,
                user_id: subscription.user_id,
                transaction_id: invoice.payment_intent,
                payment_gateway: 'stripe',
                payment_method: 'stripe',
                amount: invoice.amount_paid / 100, // Convert from cents
                currency: invoice.currency.toUpperCase(),
                status: 'completed',
                gateway_response: invoice,
                transaction_date: new Date(invoice.created * 1000)
            };
            
            await SubscriptionTransaction.create(transactionData);
            
            console.log('Recurring payment processed for subscription:', subscription.id);
        }

    } catch (error) {
        console.error('Error handling Stripe invoice payment succeeded:', error);
    }
}

async function handleStripeInvoicePaymentFailed(invoice) {
    try {
        console.log('Stripe invoice payment failed:', invoice.id);
        
        const subscriptionId = invoice.subscription;
        if (!subscriptionId) return;

        // Find subscription by Stripe subscription ID
        const subscription = await Subscription.findByPaymentGatewayId(subscriptionId);
        
        if (subscription) {
            // Create failed transaction record
            const transactionData = {
                subscription_id: subscription.id,
                user_id: subscription.user_id,
                transaction_id: invoice.payment_intent || `failed_${invoice.id}`,
                payment_gateway: 'stripe',
                payment_method: 'stripe',
                amount: invoice.amount_due / 100, // Convert from cents
                currency: invoice.currency.toUpperCase(),
                status: 'failed',
                gateway_response: invoice,
                transaction_date: new Date(invoice.created * 1000)
            };
            
            await SubscriptionTransaction.create(transactionData);
            
            // If multiple failures, suspend subscription
            const recentFailures = await SubscriptionTransaction.findBySubscriptionId(subscription.id);
            const failureCount = recentFailures.filter(t => 
                t.status === 'failed' && 
                new Date(t.transaction_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            ).length;
            
            if (failureCount >= 3) {
                await Subscription.updateStatus(subscription.id, 'suspended');
                console.log('Subscription suspended due to payment failures:', subscription.id);
            }
        }

    } catch (error) {
        console.error('Error handling Stripe invoice payment failed:', error);
    }
}

async function handleStripeSubscriptionCreated(subscription) {
    try {
        console.log('Stripe subscription created:', subscription.id);
        
        // Update our subscription record with Stripe subscription ID
        const { subscription_id } = subscription.metadata;
        
        if (subscription_id) {
            const subscriptionRecord = await Subscription.findById(subscription_id);
            if (subscriptionRecord) {
                // Update with Stripe subscription ID
                await Subscription.updateStatus(subscription_id, 'active');
                
                // Store Stripe subscription ID for future reference
                // This would require adding a column to store external IDs
                console.log('Subscription linked to Stripe:', subscription_id);
            }
        }

    } catch (error) {
        console.error('Error handling Stripe subscription created:', error);
    }
}

async function handleStripeSubscriptionUpdated(subscription) {
    try {
        console.log('Stripe subscription updated:', subscription.id);
        
        // Handle subscription status changes
        const ourSubscription = await Subscription.findByPaymentGatewayId(subscription.id);
        
        if (ourSubscription) {
            let newStatus = 'active';
            
            switch (subscription.status) {
                case 'active':
                    newStatus = 'active';
                    break;
                case 'canceled':
                    newStatus = 'cancelled';
                    break;
                case 'incomplete':
                case 'incomplete_expired':
                    newStatus = 'suspended';
                    break;
                case 'past_due':
                    newStatus = 'suspended';
                    break;
                case 'unpaid':
                    newStatus = 'suspended';
                    break;
                default:
                    newStatus = ourSubscription.status;
            }
            
            if (newStatus !== ourSubscription.status) {
                await Subscription.updateStatus(ourSubscription.id, newStatus);
                console.log('Subscription status updated:', ourSubscription.id, newStatus);
            }
        }

    } catch (error) {
        console.error('Error handling Stripe subscription updated:', error);
    }
}

async function handleStripeSubscriptionDeleted(subscription) {
    try {
        console.log('Stripe subscription deleted:', subscription.id);
        
        // Cancel our subscription
        const ourSubscription = await Subscription.findByPaymentGatewayId(subscription.id);
        
        if (ourSubscription) {
            await Subscription.updateStatus(ourSubscription.id, 'cancelled');
            console.log('Subscription cancelled:', ourSubscription.id);
        }

    } catch (error) {
        console.error('Error handling Stripe subscription deleted:', error);
    }
}

async function handleStripeTrialWillEnd(subscription) {
    try {
        console.log('Stripe trial will end:', subscription.id);
        
        // Send trial ending notification
        const ourSubscription = await Subscription.findByPaymentGatewayId(subscription.id);
        
        if (ourSubscription) {
            // Send notification to user about trial ending
            // await notificationService.sendTrialEndingNotification(ourSubscription.user_id);
            console.log('Trial ending notification sent for subscription:', ourSubscription.id);
        }

    } catch (error) {
        console.error('Error handling Stripe trial will end:', error);
    }
}

export default router; 