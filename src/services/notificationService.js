/**
 * Notification Service for Young Eagles API
 * Handles email, SMS, and other notification types for billing and subscription events
 */

class NotificationService {
    constructor() {
        this.emailEnabled = process.env.EMAIL_ENABLED === 'true';
        this.smsEnabled = process.env.SMS_ENABLED === 'true';
    }

    /**
     * Send subscription activation notification
     */
    async sendSubscriptionActivated(userId, subscription) {
        try {
            console.log(`📧 Sending subscription activation notification to user ${userId}`);
            
            // Email notification
            if (this.emailEnabled) {
                await this.sendEmail({
                    to: subscription.user_email,
                    subject: 'Welcome to Young Eagles - Subscription Activated!',
                    template: 'subscription-activated',
                    data: {
                        userName: subscription.user_name,
                        planName: subscription.plan_name,
                        amount: subscription.price_monthly || subscription.price_annual,
                        nextBilling: subscription.next_billing_date
                    }
                });
            }

            console.log(`✅ Subscription activation notification sent for user ${userId}`);
            return { success: true };
        } catch (error) {
            console.error('Error sending subscription activation notification:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send payment failed notification
     */
    async sendPaymentFailed(userId, subscription) {
        try {
            console.log(`📧 Sending payment failed notification to user ${userId}`);
            
            if (this.emailEnabled) {
                await this.sendEmail({
                    to: subscription.user_email,
                    subject: 'Payment Failed - Action Required',
                    template: 'payment-failed',
                    data: {
                        userName: subscription.user_name,
                        planName: subscription.plan_name,
                        amount: subscription.price_monthly || subscription.price_annual,
                        retryUrl: `${process.env.FRONTEND_URL}/management?tab=payments`
                    }
                });
            }

            console.log(`✅ Payment failed notification sent for user ${userId}`);
            return { success: true };
        } catch (error) {
            console.error('Error sending payment failed notification:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send trial ending notification
     */
    async sendTrialEndingNotification(userId, subscription) {
        try {
            console.log(`📧 Sending trial ending notification to user ${userId}`);
            
            if (this.emailEnabled) {
                await this.sendEmail({
                    to: subscription.user_email,
                    subject: 'Your Trial is Ending Soon',
                    template: 'trial-ending',
                    data: {
                        userName: subscription.user_name,
                        daysRemaining: subscription.trial_days_remaining,
                        upgradeUrl: `${process.env.FRONTEND_URL}/management?tab=subscription`
                    }
                });
            }

            console.log(`✅ Trial ending notification sent for user ${userId}`);
            return { success: true };
        } catch (error) {
            console.error('Error sending trial ending notification:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send renewal payment link
     */
    async sendRenewalPaymentLink(subscription, paymentUrl) {
        try {
            console.log(`📧 Sending renewal payment link for subscription ${subscription.id}`);
            
            if (this.emailEnabled) {
                await this.sendEmail({
                    to: subscription.user_email,
                    subject: 'Renew Your Young Eagles Subscription',
                    template: 'renewal-payment',
                    data: {
                        userName: subscription.user_name,
                        planName: subscription.plan_name,
                        amount: subscription.price_monthly || subscription.price_annual,
                        paymentUrl: paymentUrl,
                        expiryDate: subscription.subscription_end_date
                    }
                });
            }

            console.log(`✅ Renewal payment link sent for subscription ${subscription.id}`);
            return { success: true };
        } catch (error) {
            console.error('Error sending renewal payment link:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send renewal success notification
     */
    async sendRenewalSuccess(subscription) {
        try {
            console.log(`📧 Sending renewal success notification for subscription ${subscription.id}`);
            
            if (this.emailEnabled) {
                await this.sendEmail({
                    to: subscription.user_email,
                    subject: 'Subscription Renewed Successfully',
                    template: 'renewal-success',
                    data: {
                        userName: subscription.user_name,
                        planName: subscription.plan_name,
                        amount: subscription.price_monthly || subscription.price_annual,
                        nextBilling: subscription.next_billing_date
                    }
                });
            }

            console.log(`✅ Renewal success notification sent for subscription ${subscription.id}`);
            return { success: true };
        } catch (error) {
            console.error('Error sending renewal success notification:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send generic email notification
     */
    async sendEmail({ to, subject, template, data }) {
        // In a production environment, this would integrate with an email service
        // like SendGrid, AWS SES, or Nodemailer
        
        if (!this.emailEnabled) {
            console.log(`📧 Email disabled - would send: ${subject} to ${to}`);
            return { success: true, message: 'Email disabled' };
        }

        console.log(`📧 Email notification:
To: ${to}
Subject: ${subject}
Template: ${template}
Data:`, data);

        // Mock email sending - replace with actual email service integration
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({ 
                    success: true, 
                    messageId: `mock_${Date.now()}`,
                    message: 'Email sent successfully (mock)' 
                });
            }, 100);
        });
    }

    /**
     * Send SMS notification
     */
    async sendSMS({ to, message }) {
        if (!this.smsEnabled) {
            console.log(`📱 SMS disabled - would send: ${message} to ${to}`);
            return { success: true, message: 'SMS disabled' };
        }

        console.log(`📱 SMS notification:
To: ${to}
Message: ${message}`);

        // Mock SMS sending - replace with actual SMS service integration
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({ 
                    success: true, 
                    messageId: `sms_mock_${Date.now()}`,
                    message: 'SMS sent successfully (mock)' 
                });
            }, 100);
        });
    }

    /**
     * Send billing alert to admins
     */
    async sendBillingAlert(message, data = {}) {
        try {
            const adminEmail = process.env.ADMIN_EMAIL || 'admin@youngeagles.org.za';
            
            await this.sendEmail({
                to: adminEmail,
                subject: 'Young Eagles Billing Alert',
                template: 'billing-alert',
                data: {
                    message,
                    timestamp: new Date().toISOString(),
                    ...data
                }
            });

            return { success: true };
        } catch (error) {
            console.error('Error sending billing alert:', error);
            return { success: false, error: error.message };
        }
    }
}

export default new NotificationService(); 