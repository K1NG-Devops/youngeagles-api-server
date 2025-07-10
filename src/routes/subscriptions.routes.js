import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import Subscription from '../models/Subscription.js';
import SubscriptionTransaction from '../models/SubscriptionTransaction.js';
import payfastService from '../services/payfastService.js';
import stripeService from '../services/stripeService.js';
import nativeNotificationService from '../services/nativeNotificationService.js';

const router = express.Router();

// Get current user subscription
router.get('/current', authMiddleware, async (req, res) => {
    try {
        const subscription = await Subscription.findActiveByUserId(req.user.id);
        
        if (!subscription) {
            // Return default free plan
            return res.json({
                success: true,
                data: {
                    subscription: {
                        plan_id: 'free',
                        plan_name: 'Free Plan',
                        status: 'active',
                        subscription_end_date: null,
                        auto_renew: false,
                        user_id: req.user.id
                    }
                }
            });
        }
        
        res.json({
            success: true,
            data: { subscription }
        });
    } catch (error) {
        console.error('Error fetching current subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription'
        });
    }
});

// Get user subscription history
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const subscriptions = await Subscription.findByUserId(req.user.id);
        
        res.json({
            success: true,
            data: { subscriptions }
        });
    } catch (error) {
        console.error('Error fetching subscription history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription history'
        });
    }
});

// Get available plans
router.get('/plans', async (req, res) => {
    try {
        const plans = {
            free: {
                id: 'free',
                name: 'Free Plan',
                description: 'Basic features with limited access',
                price: 0,
                priceAnnual: 0,
                features: {
                    children_limit: 1,
                    homework_limit: 5,
                    activities_limit: 3,
                    storage_limit: 100, // MB
                    ads_enabled: true,
                    no_ads: false,
                    progress_tracking: false,
                    priority_support: false,
                    bulk_management: false,
                    analytics: false,
                    api_access: false
                },
                trial_days: 0
            },
            student: {
                id: 'student',
                name: 'Student Plan',
                description: 'Perfect for individual students',
                price: 99,
                priceAnnual: 990,
                features: {
                    children_limit: 1,
                    homework_limit: null,
                    activities_limit: null,
                    storage_limit: null,
                    ads_enabled: false,
                    no_ads: true,
                    progress_tracking: true,
                    priority_support: true,
                    bulk_management: false,
                    analytics: false,
                    api_access: false
                },
                trial_days: 7,
                popular: true
            },
            family: {
                id: 'family',
                name: 'Family Plan',
                description: 'Ideal for families with multiple children',
                price: 199,
                priceAnnual: 1990,
                features: {
                    children_limit: 5,
                    homework_limit: null,
                    activities_limit: null,
                    storage_limit: null,
                    ads_enabled: false,
                    no_ads: true,
                    progress_tracking: true,
                    priority_support: true,
                    bulk_management: true,
                    analytics: true,
                    api_access: false
                },
                trial_days: 14
            },
            institution: {
                id: 'institution',
                name: 'Institution Plan',
                description: 'Comprehensive solution for schools',
                price: 399,
                priceAnnual: 3990,
                features: {
                    children_limit: null,
                    homework_limit: null,
                    activities_limit: null,
                    storage_limit: null,
                    ads_enabled: false,
                    no_ads: true,
                    progress_tracking: true,
                    priority_support: true,
                    bulk_management: true,
                    analytics: true,
                    api_access: true
                },
                trial_days: 30
            }
        };
        
        res.json({
            success: true,
            data: { plans }
        });
    } catch (error) {
        console.error('Error fetching plans:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch plans'
        });
    }
});

// Upgrade subscription
router.post('/upgrade', authMiddleware, async (req, res) => {
    try {
        const { planId, billingCycle = 'monthly', paymentMethod = 'payfast' } = req.body;
        
        if (!planId || !['student', 'family', 'institution'].includes(planId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid plan selected'
            });
        }
        
        if (!['monthly', 'annual'].includes(billingCycle)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid billing cycle'
            });
        }
        
        const planPrices = {
            student: { monthly: 99, annual: 990 },
            family: { monthly: 199, annual: 1990 },
            institution: { monthly: 399, annual: 3990 }
        };
        
        const amount = planPrices[planId][billingCycle];
        
        // Create subscription record
        const subscriptionData = {
            user_id: req.user.id,
            plan_id: planId,
            plan_name: planId.charAt(0).toUpperCase() + planId.slice(1) + ' Plan',
            price_monthly: planPrices[planId].monthly,
            price_annual: planPrices[planId].annual,
            billing_cycle: billingCycle,
            status: 'pending',
            payment_method: paymentMethod,
            subscription_start_date: new Date(),
            subscription_end_date: new Date(Date.now() + (billingCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000),
            next_billing_date: new Date(Date.now() + (billingCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000),
            auto_renew: true,
            metadata: {
                upgrade_source: 'user_request',
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            }
        };
        
        const subscription = await Subscription.create(subscriptionData);
        
        // Process payment based on method
        let paymentResult;
        
        if (paymentMethod === 'payfast') {
            paymentResult = await payfastService.createPayment({
                amount: amount,
                item_name: `${subscriptionData.plan_name} - ${billingCycle}`,
                item_description: `YoungEagles ${subscriptionData.plan_name} subscription`,
                custom_int1: subscription.id,
                custom_str1: req.user.id,
                email_address: req.user.email,
                name_first: req.user.first_name || req.user.name?.split(' ')[0] || 'User',
                name_last: req.user.last_name || req.user.name?.split(' ')[1] || 'User',
                return_url: `${process.env.FRONTEND_URL}/payment/success`,
                cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
                notify_url: `${process.env.API_URL}/webhooks/payfast`
            });
        } else if (paymentMethod === 'stripe') {
            paymentResult = await stripeService.createPaymentIntent({
                amount: amount * 100, // Stripe expects cents
                currency: 'zar',
                metadata: {
                    subscription_id: subscription.id,
                    user_id: req.user.id,
                    plan_id: planId,
                    billing_cycle: billingCycle
                }
            });
        }
        
        // Create transaction record
        const transactionData = {
            subscription_id: subscription.id,
            user_id: req.user.id,
            transaction_id: paymentResult.transaction_id || paymentResult.id,
            payment_gateway: paymentMethod,
            payment_method: paymentMethod,
            amount: amount,
            currency: 'ZAR',
            status: 'pending',
            gateway_response: paymentResult,
            transaction_date: new Date()
        };
        
        await SubscriptionTransaction.create(transactionData);
        
        // Update subscription with payment gateway ID
        await Subscription.updateStatus(subscription.id, 'pending');
        
        res.json({
            success: true,
            data: {
                subscription,
                checkout_url: paymentResult.checkout_url || paymentResult.url,
                payment_method: paymentMethod,
                amount: amount,
                transaction_id: paymentResult.transaction_id || paymentResult.id
            }
        });
        
    } catch (error) {
        console.error('Error upgrading subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upgrade subscription'
        });
    }
});

// Cancel subscription
router.post('/cancel', authMiddleware, async (req, res) => {
    try {
        const { reason } = req.body;
        
        const subscription = await Subscription.findActiveByUserId(req.user.id);
        
        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'No active subscription found'
            });
        }
        
        const success = await Subscription.cancel(subscription.id, reason, req.user.id);
        
        if (success) {
            res.json({
                success: true,
                message: 'Subscription cancelled successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to cancel subscription'
            });
        }
        
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel subscription'
        });
    }
});

// Reactivate subscription
router.post('/reactivate', authMiddleware, async (req, res) => {
    try {
        const subscriptions = await Subscription.findByUserId(req.user.id);
        const cancelledSubscription = subscriptions.find(s => s.status === 'cancelled');
        
        if (!cancelledSubscription) {
            return res.status(404).json({
                success: false,
                message: 'No cancelled subscription found'
            });
        }
        
        const success = await Subscription.reactivate(cancelledSubscription.id);
        
        if (success) {
            res.json({
                success: true,
                message: 'Subscription reactivated successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to reactivate subscription'
            });
        }
        
    } catch (error) {
        console.error('Error reactivating subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reactivate subscription'
        });
    }
});

// Get user features
router.get('/features', authMiddleware, async (req, res) => {
    try {
        const subscription = await Subscription.findActiveByUserId(req.user.id);
        
        let features = {
            children_limit: 1,
            homework_limit: 5,
            activities_limit: 3,
            storage_limit: 100,
            ads_enabled: true,
            no_ads: false,
            progress_tracking: false,
            priority_support: false,
            bulk_management: false,
            analytics: false,
            api_access: false
        };
        
        if (subscription) {
            const planFeatures = {
                student: {
                    children_limit: 1,
                    homework_limit: null,
                    activities_limit: null,
                    storage_limit: null,
                    ads_enabled: false,
                    no_ads: true,
                    progress_tracking: true,
                    priority_support: true,
                    bulk_management: false,
                    analytics: false,
                    api_access: false
                },
                family: {
                    children_limit: 5,
                    homework_limit: null,
                    activities_limit: null,
                    storage_limit: null,
                    ads_enabled: false,
                    no_ads: true,
                    progress_tracking: true,
                    priority_support: true,
                    bulk_management: true,
                    analytics: true,
                    api_access: false
                },
                institution: {
                    children_limit: null,
                    homework_limit: null,
                    activities_limit: null,
                    storage_limit: null,
                    ads_enabled: false,
                    no_ads: true,
                    progress_tracking: true,
                    priority_support: true,
                    bulk_management: true,
                    analytics: true,
                    api_access: true
                }
            };
            
            features = planFeatures[subscription.plan_id] || features;
        }
        
        res.json({
            success: true,
            data: { features }
        });
        
    } catch (error) {
        console.error('Error fetching features:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch features'
        });
    }
});

// Get user usage
router.get('/usage', authMiddleware, async (req, res) => {
    try {
        // In a real implementation, you would fetch usage from a usage tracking table
        // For now, return mock data
        const usage = {
            homework_created: 2,
            activities_created: 1,
            storage_used: 45, // MB
            children_count: 1
        };
        
        res.json({
            success: true,
            data: { usage }
        });
        
    } catch (error) {
        console.error('Error fetching usage:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch usage'
        });
    }
});

// Increment usage
router.post('/usage/increment', authMiddleware, async (req, res) => {
    try {
        const { feature } = req.body;
        
        if (!feature) {
            return res.status(400).json({
                success: false,
                message: 'Feature name is required'
            });
        }
        
        // In a real implementation, you would update the usage tracking table
        // For now, just return success
        
        res.json({
            success: true,
            message: 'Usage incremented successfully'
        });
        
    } catch (error) {
        console.error('Error incrementing usage:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to increment usage'
        });
    }
});

// Get payment history
router.get('/payments', authMiddleware, async (req, res) => {
    try {
        const { limit = 10, offset = 0 } = req.query;
        
        const payments = await SubscriptionTransaction.getPaymentHistory(
            req.user.id,
            parseInt(limit),
            parseInt(offset)
        );
        
        res.json({
            success: true,
            data: { payments }
        });
        
    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment history'
        });
    }
});

// Check feature access
router.get('/features/:feature', authMiddleware, async (req, res) => {
    try {
        const { feature } = req.params;
        
        const hasAccess = await Subscription.hasFeatureAccess(req.user.id, feature);
        
        res.json({
            success: true,
            data: { hasAccess }
        });
        
    } catch (error) {
        console.error('Error checking feature access:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check feature access'
        });
    }
});

// Admin routes (require admin auth)
router.get('/admin/stats', authMiddleware, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        const stats = await Subscription.getSubscriptionStats();
        const revenueStats = await SubscriptionTransaction.getRevenueStats();
        
        res.json({
            success: true,
            data: { stats, revenueStats }
        });
        
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stats'
        });
    }
});

// Admin manual subscription management
router.post('/admin/manual-subscription', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        const { userId, planId, billingCycle, duration } = req.body;
        
        const subscriptionData = {
            user_id: userId,
            plan_id: planId,
            plan_name: planId.charAt(0).toUpperCase() + planId.slice(1) + ' Plan',
            price_monthly: 0,
            price_annual: 0,
            billing_cycle: billingCycle,
            status: 'active',
            payment_method: 'manual',
            subscription_start_date: new Date(),
            subscription_end_date: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
            next_billing_date: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
            auto_renew: false,
            created_by: req.user.id,
            metadata: {
                manual_creation: true,
                created_by_admin: req.user.id
            }
        };
        
        const subscription = await Subscription.create(subscriptionData);
        
        res.json({
            success: true,
            data: { subscription },
            message: 'Manual subscription created successfully'
        });
        
    } catch (error) {
        console.error('Error creating manual subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create manual subscription'
        });
    }
});

export default router; 