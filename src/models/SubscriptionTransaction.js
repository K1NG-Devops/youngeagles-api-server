import mysql from 'mysql2/promise';
import config from '../config/database.js';

class SubscriptionTransaction {
    constructor({
        subscription_id,
        user_id,
        transaction_id,
        payment_gateway,
        payment_method,
        amount,
        currency = 'ZAR',
        status = 'pending',
        gateway_response = {},
        transaction_date,
        processed_at = null
    }) {
        this.subscription_id = subscription_id;
        this.user_id = user_id;
        this.transaction_id = transaction_id;
        this.payment_gateway = payment_gateway;
        this.payment_method = payment_method;
        this.amount = amount;
        this.currency = currency;
        this.status = status;
        this.gateway_response = typeof gateway_response === 'string' ? gateway_response : JSON.stringify(gateway_response);
        this.transaction_date = transaction_date;
        this.processed_at = processed_at;
    }

    static async create(transaction) {
        const connection = await mysql.createConnection(config);
        try {
            const [result] = await connection.execute(
                `INSERT INTO subscription_transactions (
                    subscription_id, user_id, transaction_id, payment_gateway,
                    payment_method, amount, currency, status, gateway_response,
                    transaction_date, processed_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    transaction.subscription_id, transaction.user_id, transaction.transaction_id,
                    transaction.payment_gateway, transaction.payment_method, transaction.amount,
                    transaction.currency, transaction.status, transaction.gateway_response,
                    transaction.transaction_date, transaction.processed_at
                ]
            );
            return { ...transaction, id: result.insertId };
        } finally {
            await connection.end();
        }
    }

    static async findById(id) {
        const connection = await mysql.createConnection(config);
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM subscription_transactions WHERE id = ?',
                [id]
            );
            return rows[0];
        } finally {
            await connection.end();
        }
    }

    static async findByTransactionId(transactionId, paymentGateway) {
        const connection = await mysql.createConnection(config);
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM subscription_transactions WHERE transaction_id = ? AND payment_gateway = ?',
                [transactionId, paymentGateway]
            );
            return rows[0];
        } finally {
            await connection.end();
        }
    }

    static async findBySubscriptionId(subscriptionId) {
        const connection = await mysql.createConnection(config);
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM subscription_transactions WHERE subscription_id = ? ORDER BY transaction_date DESC',
                [subscriptionId]
            );
            return rows;
        } finally {
            await connection.end();
        }
    }

    static async findByUserId(userId) {
        const connection = await mysql.createConnection(config);
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM subscription_transactions WHERE user_id = ? ORDER BY transaction_date DESC',
                [userId]
            );
            return rows;
        } finally {
            await connection.end();
        }
    }

    static async updateStatus(id, status, gatewayResponse = null) {
        const connection = await mysql.createConnection(config);
        try {
            const updateData = [status];
            let query = 'UPDATE subscription_transactions SET status = ?, updated_at = NOW()';
            
            if (status === 'completed' || status === 'failed') {
                query += ', processed_at = NOW()';
            }
            
            if (gatewayResponse) {
                query += ', gateway_response = ?';
                updateData.push(typeof gatewayResponse === 'string' ? gatewayResponse : JSON.stringify(gatewayResponse));
            }
            
            query += ' WHERE id = ?';
            updateData.push(id);

            const [result] = await connection.execute(query, updateData);
            return result.affectedRows > 0;
        } finally {
            await connection.end();
        }
    }

    static async getPaymentHistory(userId, limit = 10, offset = 0) {
        const connection = await mysql.createConnection(config);
        try {
            const [rows] = await connection.execute(
                `SELECT 
                    st.*,
                    s.plan_name,
                    s.billing_cycle
                FROM subscription_transactions st
                JOIN subscriptions s ON st.subscription_id = s.id
                WHERE st.user_id = ?
                ORDER BY st.transaction_date DESC
                LIMIT ? OFFSET ?`,
                [userId, limit, offset]
            );
            return rows;
        } finally {
            await connection.end();
        }
    }

    static async getRevenueStats(startDate = null, endDate = null) {
        const connection = await mysql.createConnection(config);
        try {
            let query = `
                SELECT 
                    COUNT(*) as total_transactions,
                    SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
                    SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_revenue,
                    SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as failed_revenue,
                    AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as average_transaction_value,
                    payment_gateway,
                    currency
                FROM subscription_transactions
            `;
            
            const params = [];
            
            if (startDate && endDate) {
                query += ' WHERE transaction_date BETWEEN ? AND ?';
                params.push(startDate, endDate);
            }
            
            query += ' GROUP BY payment_gateway, currency';
            
            const [rows] = await connection.execute(query, params);
            return rows;
        } finally {
            await connection.end();
        }
    }

    static async getMonthlyRevenue(year = null) {
        const connection = await mysql.createConnection(config);
        try {
            let query = `
                SELECT 
                    YEAR(transaction_date) as year,
                    MONTH(transaction_date) as month,
                    SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as revenue,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions
                FROM subscription_transactions
            `;
            
            const params = [];
            
            if (year) {
                query += ' WHERE YEAR(transaction_date) = ?';
                params.push(year);
            }
            
            query += ' GROUP BY YEAR(transaction_date), MONTH(transaction_date) ORDER BY year DESC, month DESC';
            
            const [rows] = await connection.execute(query, params);
            return rows;
        } finally {
            await connection.end();
        }
    }

    static async findPendingTransactions(hoursOld = 24) {
        const connection = await mysql.createConnection(config);
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM subscription_transactions WHERE status = ? AND created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)',
                ['pending', hoursOld]
            );
            return rows;
        } finally {
            await connection.end();
        }
    }

    static async markAsExpired(id) {
        const connection = await mysql.createConnection(config);
        try {
            const [result] = await connection.execute(
                'UPDATE subscription_transactions SET status = ?, updated_at = NOW() WHERE id = ?',
                ['expired', id]
            );
            return result.affectedRows > 0;
        } finally {
            await connection.end();
        }
    }

    static async findRefundableTransactions(userId = null) {
        const connection = await mysql.createConnection(config);
        try {
            let query = `
                SELECT st.*, s.plan_name, s.billing_cycle
                FROM subscription_transactions st
                JOIN subscriptions s ON st.subscription_id = s.id
                WHERE st.status = 'completed' 
                AND st.transaction_date > DATE_SUB(NOW(), INTERVAL 30 DAY)
            `;
            
            const params = [];
            
            if (userId) {
                query += ' AND st.user_id = ?';
                params.push(userId);
            }
            
            query += ' ORDER BY st.transaction_date DESC';
            
            const [rows] = await connection.execute(query, params);
            return rows;
        } finally {
            await connection.end();
        }
    }

    static async processRefund(transactionId, refundAmount, refundReason = null) {
        const connection = await mysql.createConnection(config);
        try {
            await connection.beginTransaction();
            
            // Update original transaction
            await connection.execute(
                'UPDATE subscription_transactions SET status = ?, updated_at = NOW() WHERE id = ?',
                ['refunded', transactionId]
            );
            
            // Create refund transaction record
            const originalTransaction = await this.findById(transactionId);
            if (originalTransaction) {
                await connection.execute(
                    `INSERT INTO subscription_transactions (
                        subscription_id, user_id, transaction_id, payment_gateway,
                        payment_method, amount, currency, status, gateway_response,
                        transaction_date, processed_at, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW(), NOW())`,
                    [
                        originalTransaction.subscription_id,
                        originalTransaction.user_id,
                        `refund_${originalTransaction.transaction_id}`,
                        originalTransaction.payment_gateway,
                        originalTransaction.payment_method,
                        -refundAmount,
                        originalTransaction.currency,
                        'completed',
                        JSON.stringify({ refund_reason: refundReason, original_transaction_id: transactionId })
                    ]
                );
            }
            
            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            await connection.end();
        }
    }
}

export default SubscriptionTransaction; 