import express from 'express';
import { execute } from '../db.js';

const router = express.Router();

// Migration endpoint - creates missing tables
router.post('/create-tables', async (req, res) => {
    console.log('🔧 Migration endpoint called - creating missing tables...');
    
    const results = [];
    
    try {
        // Create the missing subscriptions table
        console.log('📝 Creating subscriptions table...');
        await execute(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                plan_id VARCHAR(50) NOT NULL,
                plan_name VARCHAR(100) NOT NULL,
                price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                price_annual DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                billing_cycle ENUM('monthly', 'annual') NOT NULL DEFAULT 'monthly',
                status ENUM('active', 'cancelled', 'expired', 'suspended', 'trial') NOT NULL DEFAULT 'active',
                payment_method ENUM('payfast', 'stripe', 'manual', 'bank_transfer') NOT NULL DEFAULT 'payfast',
                payment_gateway_id VARCHAR(255) DEFAULT NULL,
                subscription_start_date DATETIME NOT NULL,
                subscription_end_date DATETIME NOT NULL,
                next_billing_date DATETIME NOT NULL,
                auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
                trial_end_date DATETIME DEFAULT NULL,
                created_by INT DEFAULT NULL,
                cancelled_at DATETIME DEFAULT NULL,
                cancelled_by INT DEFAULT NULL,
                cancellation_reason TEXT DEFAULT NULL,
                metadata JSON DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_user_id (user_id),
                INDEX idx_status (status),
                INDEX idx_payment_gateway_id (payment_gateway_id),
                INDEX idx_subscription_end_date (subscription_end_date),
                INDEX idx_next_billing_date (next_billing_date),
                INDEX idx_user_status (user_id, status)
            )
        `);
        results.push('✅ Subscriptions table created');
        
        // Create subscription_features table
        console.log('📝 Creating subscription_features table...');
        await execute(`
            CREATE TABLE IF NOT EXISTS subscription_features (
                id INT AUTO_INCREMENT PRIMARY KEY,
                plan_id VARCHAR(50) NOT NULL,
                feature_name VARCHAR(100) NOT NULL,
                feature_limit INT DEFAULT NULL,
                is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                INDEX idx_plan_id (plan_id),
                INDEX idx_feature_name (feature_name),
                
                UNIQUE KEY unique_plan_feature (plan_id, feature_name)
            )
        `);
        results.push('✅ Subscription features table created');
        
        // Create subscription_usage table
        console.log('📝 Creating subscription_usage table...');
        await execute(`
            CREATE TABLE IF NOT EXISTS subscription_usage (
                id INT AUTO_INCREMENT PRIMARY KEY,
                subscription_id INT NOT NULL,
                user_id INT NOT NULL,
                feature_name VARCHAR(100) NOT NULL,
                usage_count INT NOT NULL DEFAULT 0,
                usage_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_subscription_id (subscription_id),
                INDEX idx_user_id (user_id),
                INDEX idx_feature_name (feature_name),
                INDEX idx_usage_date (usage_date),
                
                UNIQUE KEY unique_user_feature_date (user_id, feature_name, usage_date)
            )
        `);
        results.push('✅ Subscription usage table created');
        
        // Create subscription_plan_configs table
        console.log('📝 Creating subscription_plan_configs table...');
        await execute(`
            CREATE TABLE IF NOT EXISTS subscription_plan_configs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                plan_id VARCHAR(50) NOT NULL UNIQUE,
                plan_name VARCHAR(100) NOT NULL,
                description TEXT,
                price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                price_annual DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                trial_days INT NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order INT NOT NULL DEFAULT 0,
                features JSON DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_plan_id (plan_id),
                INDEX idx_is_active (is_active),
                INDEX idx_sort_order (sort_order)
            )
        `);
        results.push('✅ Subscription plan configs table created');
        
        // Insert default subscription features
        console.log('📝 Inserting default subscription features...');
        await execute(`
            INSERT INTO subscription_features (plan_id, feature_name, feature_limit, is_enabled) VALUES
            ('free', 'basic_homework', 5, TRUE),
            ('free', 'basic_activities', 3, TRUE),
            ('free', 'limited_storage', 50, TRUE), -- Changed to 50MB
            ('free', 'ads_enabled', NULL, TRUE),
            ('free', 'communication', 0, FALSE), -- No communication for free plan
            ('student', 'basic_homework', NULL, TRUE),
            ('student', 'basic_activities', NULL, TRUE),
            ('student', 'limited_storage', 100, TRUE), -- Changed to 100MB
            ('student', 'ads_enabled', NULL, FALSE),
            ('student', 'communication', NULL, TRUE) -- Communication enabled for student plan
            ON DUPLICATE KEY UPDATE 
                feature_limit = VALUES(feature_limit),
                is_enabled = VALUES(is_enabled)
        `);
        results.push('✅ Default features inserted');
        
        // Insert default plan configs
        console.log('📝 Inserting default subscription plans...');
        await execute(`
            INSERT INTO subscription_plan_configs (plan_id, plan_name, description, price_monthly, price_annual, trial_days, is_active, sort_order, features) VALUES
            ('free', 'Free Plan', 'Basic features with limited access', 0.00, 0.00, 0, TRUE, 1, 
             JSON_OBJECT(
                'children_limit', 1, 
                'homework_limit', 5, 
                'activities_limit', 3, 
                'storage_limit', 50, 
                'ads_enabled', TRUE,
                'communication', FALSE
             )),
            ('student', 'Student Plan', 'Perfect for individual students', 99.00, 990.00, 7, TRUE, 2, 
             JSON_OBJECT(
                'children_limit', 1, 
                'homework_limit', NULL, 
                'activities_limit', NULL, 
                'storage_limit', 100, 
                'ads_enabled', FALSE,
                'communication', TRUE
             ))
            ON DUPLICATE KEY UPDATE 
                plan_name = VALUES(plan_name),
                description = VALUES(description),
                price_monthly = VALUES(price_monthly),
                price_annual = VALUES(price_annual),
                trial_days = VALUES(trial_days),
                is_active = VALUES(is_active),
                sort_order = VALUES(sort_order),
                features = VALUES(features)
        `);
        results.push('✅ Default plans inserted');
        
        console.log('🎉 All missing tables created successfully!');
        
        res.json({
            success: true,
            message: 'Database migration completed successfully',
            results: results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Migration error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Migration failed',
            timestamp: new Date().toISOString()
        });
    }
});

// Health check for migration endpoint
router.get('/status', (req, res) => {
    res.json({
        status: 'Migration endpoint ready',
        timestamp: new Date().toISOString()
    });
});

export default router; 