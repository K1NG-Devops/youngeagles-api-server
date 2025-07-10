import cron from 'node-cron';
import Subscription from '../models/Subscription.js';
import SubscriptionTransaction from '../models/SubscriptionTransaction.js';
import payfastService from './payfastService.js';
import stripeService from './stripeService.js';
import notificationService from './notificationService.js';

class BillingService {
    constructor() {
        this.isRunning = false;
        this.lastRun = null;
        this.stats = {
            renewalsProcessed: 0,
            failedRenewals: 0,
            expiredSubscriptions: 0,
            revenueProcessed: 0
        };
    }

    // Initialize billing automation
    init() {
        if (this.isRunning) {
            console.log('⚠️ Billing service already running');
            return;
        }

        console.log('🔄 Starting Billing Automation Service...');
        
        // Run renewal checks every day at 2 AM
        cron.schedule('0 2 * * *', () => {
            this.processScheduledBilling();
        }, {
            scheduled: true,
            timezone: "Africa/Johannesburg"
        });

        // Run expiry checks every 6 hours
        cron.schedule('0 */6 * * *', () => {
            this.processExpiredSubscriptions();
        }, {
            scheduled: true,
            timezone: "Africa/Johannesburg"
        });

        // Run failed payment retry every 3 days
        cron.schedule('0 3 */3 * *', () => {
            this.retryFailedPayments();
        }, {
            scheduled: true,
            timezone: "Africa/Johannesburg"
        });

        // Monthly billing summary (1st of every month at 8 AM)
        cron.schedule('0 8 1 * *', () => {
            this.generateMonthlyReport();
        }, {
            scheduled: true,
            timezone: "Africa/Johannesburg"
        });

        this.isRunning = true;
        console.log('✅ Billing automation started successfully');
    }

    // Stop billing automation
    stop() {
        cron.destroy();
        this.isRunning = false;
        console.log('🛑 Billing automation stopped');
    }

    // Process scheduled billing (daily)
    async processScheduledBilling() {
        console.log('🔄 Processing scheduled billing...');
        this.lastRun = new Date();

        try {
            // Find subscriptions due for renewal (next 24 hours)
            const dueSubscriptions = await Subscription.findSubscriptionsDueForRenewal(1);
            
            console.log(`📊 Found ${dueSubscriptions.length} subscriptions due for renewal`);

            for (const subscription of dueSubscriptions) {
                await this.processSubscriptionRenewal(subscription);
            }

            // Update stats
            this.stats.renewalsProcessed += dueSubscriptions.length;

            console.log('✅ Scheduled billing processing completed');

        } catch (error) {
            console.error('❌ Error in scheduled billing:', error);
        }
    }

    // Process individual subscription renewal
    async processSubscriptionRenewal(subscription) {
        try {
            console.log(`🔄 Processing renewal for subscription ${subscription.id}`);

            const amount = subscription.billing_cycle === 'monthly' 
                ? subscription.price_monthly 
                : subscription.price_annual;

            let renewalResult = null;

            // Process payment based on method
            if (subscription.payment_method === 'payfast') {
                renewalResult = await this.processPayFastRenewal(subscription, amount);
            } else if (subscription.payment_method === 'stripe') {
                renewalResult = await this.processStripeRenewal(subscription, amount);
            } else {
                // Manual renewals - just extend the subscription
                renewalResult = await this.processManualRenewal(subscription);
            }

            if (renewalResult.success) {
                console.log(`✅ Renewal successful for subscription ${subscription.id}`);
                await this.sendRenewalSuccessNotification(subscription);
            } else {
                console.log(`❌ Renewal failed for subscription ${subscription.id}`);
                await this.handleRenewalFailure(subscription, renewalResult.error);
            }

        } catch (error) {
            console.error(`❌ Error processing renewal for subscription ${subscription.id}:`, error);
            await this.handleRenewalFailure(subscription, error.message);
        }
    }

    // Process PayFast renewal
    async processPayFastRenewal(subscription, amount) {
        try {
            // For PayFast, create a new payment request
            const paymentData = {
                amount: amount,
                item_name: `${subscription.plan_name} Renewal - ${subscription.billing_cycle}`,
                item_description: `YoungEagles ${subscription.plan_name} subscription renewal`,
                custom_int1: subscription.id,
                custom_str1: subscription.user_id,
                email_address: subscription.user_email || 'user@youngeagles.org.za',
                name_first: subscription.user_first_name || 'User',
                name_last: subscription.user_last_name || 'User',
                return_url: `${process.env.FRONTEND_URL}/payment/success`,
                cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
                notify_url: `${process.env.API_URL}/webhooks/payfast`
            };

            const paymentResult = await payfastService.createPayment(paymentData);

            // Create transaction record
            const transactionData = {
                subscription_id: subscription.id,
                user_id: subscription.user_id,
                transaction_id: paymentResult.transaction_id,
                payment_gateway: 'payfast',
                payment_method: 'payfast',
                amount: amount,
                currency: 'ZAR',
                status: 'pending',
                gateway_response: paymentResult,
                transaction_date: new Date()
            };

            await SubscriptionTransaction.create(transactionData);

            // Send payment link to user
            await this.sendRenewalPaymentLink(subscription, paymentResult.checkout_url);

            return { success: true, transaction_id: paymentResult.transaction_id };

        } catch (error) {
            console.error('PayFast renewal error:', error);
            return { success: false, error: error.message };
        }
    }

    // Process Stripe renewal
    async processStripeRenewal(subscription, amount) {
        try {
            // For Stripe, attempt to charge the saved payment method
            const paymentResult = await stripeService.createPaymentIntent({
                amount: amount * 100, // Convert to cents
                currency: 'zar',
                customer_id: subscription.stripe_customer_id,
                description: `${subscription.plan_name} renewal`,
                metadata: {
                    subscription_id: subscription.id,
                    user_id: subscription.user_id,
                    renewal: true
                },
                confirm: true
            });

            // Create transaction record
            const transactionData = {
                subscription_id: subscription.id,
                user_id: subscription.user_id,
                transaction_id: paymentResult.id,
                payment_gateway: 'stripe',
                payment_method: 'stripe',
                amount: amount,
                currency: 'ZAR',
                status: paymentResult.status === 'succeeded' ? 'completed' : 'pending',
                gateway_response: paymentResult,
                transaction_date: new Date()
            };

            await SubscriptionTransaction.create(transactionData);

            if (paymentResult.status === 'succeeded') {
                // Update subscription dates
                await this.updateSubscriptionAfterPayment(subscription);
                return { success: true, transaction_id: paymentResult.id };
            } else {
                return { success: false, error: 'Payment not completed' };
            }

        } catch (error) {
            console.error('Stripe renewal error:', error);
            return { success: false, error: error.message };
        }
    }

    // Process manual renewal
    async processManualRenewal(subscription) {
        try {
            // For manual subscriptions, just extend the dates
            await this.updateSubscriptionAfterPayment(subscription);

            // Create a manual transaction record
            const transactionData = {
                subscription_id: subscription.id,
                user_id: subscription.user_id,
                transaction_id: `manual_${Date.now()}`,
                payment_gateway: 'manual',
                payment_method: 'manual',
                amount: 0,
                currency: 'ZAR',
                status: 'completed',
                gateway_response: { manual_renewal: true },
                transaction_date: new Date()
            };

            await SubscriptionTransaction.create(transactionData);

            return { success: true, transaction_id: transactionData.transaction_id };

        } catch (error) {
            console.error('Manual renewal error:', error);
            return { success: false, error: error.message };
        }
    }

    // Update subscription dates after successful payment
    async updateSubscriptionAfterPayment(subscription) {
        const currentEndDate = new Date(subscription.subscription_end_date);
        const daysToAdd = subscription.billing_cycle === 'monthly' ? 30 : 365;
        
        const newEndDate = new Date(currentEndDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
        const newBillingDate = new Date(newEndDate);

        await Subscription.updateNextBillingDate(subscription.id, newBillingDate);
        
        // Update subscription end date (you might need to add this method to the model)
        // await Subscription.updateEndDate(subscription.id, newEndDate);
    }

    // Handle renewal failure
    async handleRenewalFailure(subscription, errorMessage) {
        this.stats.failedRenewals++;

        // Set subscription to suspended after 3 failed attempts
        const recentFailures = await SubscriptionTransaction.findBySubscriptionId(subscription.id);
        const failureCount = recentFailures.filter(t => 
            t.status === 'failed' && 
            new Date(t.transaction_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length;

        if (failureCount >= 3) {
            await Subscription.updateStatus(subscription.id, 'suspended');
            await this.sendSubscriptionSuspendedNotification(subscription);
        } else {
            await this.sendRenewalFailureNotification(subscription, errorMessage);
        }
    }

    // Process expired subscriptions
    async processExpiredSubscriptions() {
        try {
            console.log('🔄 Processing expired subscriptions...');

            const expiredSubscriptions = await Subscription.findExpiredSubscriptions();
            
            console.log(`📊 Found ${expiredSubscriptions.length} expired subscriptions`);

            for (const subscription of expiredSubscriptions) {
                await Subscription.updateStatus(subscription.id, 'expired');
                await this.sendSubscriptionExpiredNotification(subscription);
            }

            this.stats.expiredSubscriptions += expiredSubscriptions.length;

            console.log('✅ Expired subscriptions processing completed');

        } catch (error) {
            console.error('❌ Error processing expired subscriptions:', error);
        }
    }

    // Retry failed payments
    async retryFailedPayments() {
        try {
            console.log('🔄 Retrying failed payments...');

            // Find pending transactions older than 24 hours
            const pendingTransactions = await SubscriptionTransaction.findPendingTransactions(24);
            
            console.log(`📊 Found ${pendingTransactions.length} pending transactions to retry`);

            for (const transaction of pendingTransactions) {
                // Mark old pending transactions as expired
                await SubscriptionTransaction.markAsExpired(transaction.id);
            }

            console.log('✅ Failed payment retry completed');

        } catch (error) {
            console.error('❌ Error retrying failed payments:', error);
        }
    }

    // Generate monthly billing report
    async generateMonthlyReport() {
        try {
            console.log('📊 Generating monthly billing report...');

            const currentDate = new Date();
            const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
            const thisMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

            const revenueStats = await SubscriptionTransaction.getRevenueStats(
                lastMonth.toISOString(),
                thisMonth.toISOString()
            );

            const subscriptionStats = await Subscription.getSubscriptionStats();
            
            const report = {
                period: `${lastMonth.toISOString().split('T')[0]} to ${thisMonth.toISOString().split('T')[0]}`,
                revenue: revenueStats,
                subscriptions: subscriptionStats,
                automation_stats: this.stats,
                generated_at: new Date().toISOString()
            };

            console.log('📈 Monthly Report Generated:', report);

            // Send report to admins
            await this.sendMonthlyReportToAdmins(report);

            // Reset stats for next month
            this.stats = {
                renewalsProcessed: 0,
                failedRenewals: 0,
                expiredSubscriptions: 0,
                revenueProcessed: 0
            };

        } catch (error) {
            console.error('❌ Error generating monthly report:', error);
        }
    }

    // Notification methods
    async sendRenewalSuccessNotification(subscription) {
        // Implementation would depend on your notification service
        console.log(`📧 Sending renewal success notification for subscription ${subscription.id}`);
    }

    async sendRenewalPaymentLink(subscription, paymentUrl) {
        // Implementation would send payment link to user
        console.log(`📧 Sending payment link for subscription ${subscription.id}: ${paymentUrl}`);
    }

    async sendRenewalFailureNotification(subscription, error) {
        console.log(`📧 Sending renewal failure notification for subscription ${subscription.id}: ${error}`);
    }

    async sendSubscriptionSuspendedNotification(subscription) {
        console.log(`📧 Sending subscription suspended notification for subscription ${subscription.id}`);
    }

    async sendSubscriptionExpiredNotification(subscription) {
        console.log(`📧 Sending subscription expired notification for subscription ${subscription.id}`);
    }

    async sendMonthlyReportToAdmins(report) {
        console.log('📧 Sending monthly report to admins:', report);
    }

    // Manual billing operations
    async processManualBilling(subscriptionId) {
        try {
            const subscription = await Subscription.findById(subscriptionId);
            if (!subscription) {
                throw new Error('Subscription not found');
            }

            await this.processSubscriptionRenewal(subscription);
            return { success: true };

        } catch (error) {
            console.error('Manual billing error:', error);
            return { success: false, error: error.message };
        }
    }

    // Get billing statistics
    getBillingStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            lastRun: this.lastRun
        };
    }

    // Test billing system
    async testBillingSystem() {
        try {
            console.log('🧪 Testing billing system...');

            // Test database connections
            const testStats = await Subscription.getSubscriptionStats();
            console.log('✅ Database connection test passed');

            // Test payment gateways
            const payfastTest = await payfastService.testConnection();
            const stripeTest = await stripeService.testConnection();

            console.log('✅ Payment gateway tests completed');

            return {
                success: true,
                database: true,
                payfast: payfastTest.success,
                stripe: stripeTest.success,
                stats: testStats
            };

        } catch (error) {
            console.error('❌ Billing system test failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Create singleton instance
const billingService = new BillingService();

export default billingService; 