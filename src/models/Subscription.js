import { execute, query } from '../db.js';

class Subscription {
    constructor({
        user_id,
        plan_id,
        plan_name,
        price_monthly,
        price_annual,
        billing_cycle = 'monthly', // monthly, annual
        status = 'active', // active, cancelled, expired, suspended
        payment_method = 'payfast', // payfast, stripe, manual
        payment_gateway_id = null,
        subscription_start_date,
        subscription_end_date,
        next_billing_date,
        auto_renew = true,
        trial_end_date = null,
        created_by = null,
        cancelled_at = null,
        cancelled_by = null,
        cancellation_reason = null,
        metadata = {}
    }) {
        this.user_id = user_id;
        this.plan_id = plan_id;
        this.plan_name = plan_name;
        this.price_monthly = price_monthly;
        this.price_annual = price_annual;
        this.billing_cycle = billing_cycle;
        this.status = status;
        this.payment_method = payment_method;
        this.payment_gateway_id = payment_gateway_id;
        this.subscription_start_date = subscription_start_date;
        this.subscription_end_date = subscription_end_date;
        this.next_billing_date = next_billing_date;
        this.auto_renew = auto_renew;
        this.trial_end_date = trial_end_date;
        this.created_by = created_by;
        this.cancelled_at = cancelled_at;
        this.cancelled_by = cancelled_by;
        this.cancellation_reason = cancellation_reason;
        this.metadata = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
    }

    static async create(subscription) {
        const [result] = await execute(
            `INSERT INTO subscriptions (
                    user_id, plan_id, plan_name, price_monthly, price_annual,
                    billing_cycle, status, payment_method, payment_gateway_id,
                    subscription_start_date, subscription_end_date, next_billing_date,
                    auto_renew, trial_end_date, created_by, cancelled_at,
                    cancelled_by, cancellation_reason, metadata, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    subscription.user_id, subscription.plan_id, subscription.plan_name,
                    subscription.price_monthly, subscription.price_annual, subscription.billing_cycle,
                    subscription.status, subscription.payment_method, subscription.payment_gateway_id,
                    subscription.subscription_start_date, subscription.subscription_end_date,
                    subscription.next_billing_date, subscription.auto_renew, subscription.trial_end_date,
                    subscription.created_by, subscription.cancelled_at, subscription.cancelled_by,
                    subscription.cancellation_reason, subscription.metadata
                ]
            );
            return { ...subscription, id: result.insertId };
    }

    static async findById(id) {
        try {
            const result = await query(
            'SELECT * FROM subscriptions WHERE id = ?',
            [id]
        );
            // Handle both [rows] and rows formats
            const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
            return rows && rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error finding subscription by ID:', error);
            return null;
        }
    }

    static async findByUserId(userId) {
        try {
            const result = await query(
            'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
            // Handle both [rows] and rows formats
            const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
            return rows || [];
        } catch (error) {
            console.error('Error finding subscriptions by user ID:', error);
            return [];
        }
    }

    static async findActiveByUserId(userId) {
        try {
            const result = await query(
            'SELECT * FROM subscriptions WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
            [userId, 'active']
        );
            // Handle both [rows] and rows formats
            const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
            return rows && rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error finding active subscription by user ID:', error);
            // If subscriptions table doesn't exist, return null (user will get free plan)
            return null;
        }
    }

    static async findByPaymentGatewayId(paymentGatewayId) {
        try {
            const result = await query(
            'SELECT * FROM subscriptions WHERE payment_gateway_id = ?',
            [paymentGatewayId]
        );
            // Handle both [rows] and rows formats
            const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
            return rows && rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error finding subscription by payment gateway ID:', error);
            return null;
        }
    }

    static async updateStatus(id, status, updatedBy = null) {
        try {
        const updateData = [status];
        let queryString = 'UPDATE subscriptions SET status = ?, updated_at = NOW()';
        
        if (status === 'cancelled') {
            queryString += ', cancelled_at = NOW(), cancelled_by = ?';
            updateData.push(updatedBy);
        }
        
        queryString += ' WHERE id = ?';
        updateData.push(id);

        const [result] = await execute(queryString, updateData);
        return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating subscription status:', error);
            return false;
        }
    }

    static async updateNextBillingDate(id, nextBillingDate) {
        try {
        const [result] = await execute(
            'UPDATE subscriptions SET next_billing_date = ?, updated_at = NOW() WHERE id = ?',
            [nextBillingDate, id]
        );
        return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating next billing date:', error);
            return false;
        }
    }

    static async findExpiredSubscriptions() {
        try {
            const result = await query(
            'SELECT * FROM subscriptions WHERE status = ? AND subscription_end_date < NOW()',
            ['active']
        );
            const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
            return rows || [];
        } catch (error) {
            console.error('Error finding expired subscriptions:', error);
            return [];
        }
    }

    static async findSubscriptionsDueForRenewal(daysAhead = 1) {
        try {
            const result = await query(
            'SELECT * FROM subscriptions WHERE status = ? AND auto_renew = ? AND next_billing_date <= DATE_ADD(NOW(), INTERVAL ? DAY)',
            ['active', true, daysAhead]
        );
            const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
            return rows || [];
        } catch (error) {
            console.error('Error finding subscriptions due for renewal:', error);
            return [];
        }
    }

    static async getSubscriptionStats() {
        try {
            const result = await query(`
            SELECT 
                COUNT(*) as total_subscriptions,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_subscriptions,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_subscriptions,
                SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_subscriptions,
                SUM(CASE WHEN billing_cycle = 'monthly' THEN price_monthly ELSE price_annual/12 END) as monthly_recurring_revenue,
                AVG(CASE WHEN billing_cycle = 'monthly' THEN price_monthly ELSE price_annual/12 END) as average_revenue_per_user
            FROM subscriptions 
            WHERE status = 'active'
        `);
            const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
            return rows && rows.length > 0 ? rows[0] : {
                total_subscriptions: 0,
                active_subscriptions: 0,
                cancelled_subscriptions: 0,
                expired_subscriptions: 0,
                monthly_recurring_revenue: 0,
                average_revenue_per_user: 0
            };
        } catch (error) {
            console.error('Error getting subscription stats:', error);
            return {
                total_subscriptions: 0,
                active_subscriptions: 0,
                cancelled_subscriptions: 0,
                expired_subscriptions: 0,
                monthly_recurring_revenue: 0,
                average_revenue_per_user: 0
            };
        }
    }

    static async cancel(id, reason = null, cancelledBy = null) {
        try {
        const [result] = await execute(
            'UPDATE subscriptions SET status = ?, cancelled_at = NOW(), cancelled_by = ?, cancellation_reason = ?, updated_at = NOW() WHERE id = ?',
            ['cancelled', cancelledBy, reason, id]
        );
        return result.affectedRows > 0;
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            return false;
        }
    }

    static async reactivate(id) {
        try {
        const [result] = await execute(
            'UPDATE subscriptions SET status = ?, cancelled_at = NULL, cancelled_by = NULL, cancellation_reason = NULL, updated_at = NOW() WHERE id = ?',
            ['active', id]
        );
        return result.affectedRows > 0;
        } catch (error) {
            console.error('Error reactivating subscription:', error);
            return false;
        }
    }

    // Feature access control
    static async hasFeatureAccess(userId, feature) {
        try {
            const result = await query(
            'SELECT plan_id FROM subscriptions WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
            [userId, 'active']
        );
        
            const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
            if (!rows || rows.length === 0) return false;
        
        const planId = rows[0].plan_id;
        return this.checkFeatureAccess(planId, feature);
        } catch (error) {
            console.error('Error checking feature access:', error);
            return false;
        }
    }

    static checkFeatureAccess(planId, feature) {
        const planFeatures = {
            'free': ['basic_homework', 'basic_activities', 'limited_storage'],
            'student': ['basic_homework', 'basic_activities', 'unlimited_storage', 'progress_tracking'],
            'family': ['basic_homework', 'basic_activities', 'unlimited_storage', 'progress_tracking', 'multiple_children', 'priority_support'],
            'institution': ['basic_homework', 'basic_activities', 'unlimited_storage', 'progress_tracking', 'multiple_children', 'priority_support', 'bulk_management', 'analytics', 'api_access']
        };
        
        return planFeatures[planId]?.includes(feature) || false;
    }
}

export default Subscription; 