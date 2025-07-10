#!/usr/bin/env node

import 'dotenv/config';
import mysql from 'mysql2/promise';
import config from './src/config/database.js';

async function createMissingTables() {
    console.log('🔌 Connecting to database using API server configuration...');
    console.log(`📊 Target: ${config.host}:${config.database}`);
    
    let connection;
    
    try {
        // Use the exact same database config as the API server
        connection = await mysql.createConnection(config);
        console.log('✅ Database connected successfully!');
        
        // Create the missing subscriptions table (the main one causing errors)
        console.log('📝 Creating subscriptions table...');
        await connection.execute(`
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
        console.log('✅ Subscriptions table created!');
        
        // Create subscription_features table
        console.log('📝 Creating subscription_features table...');
        await connection.execute(`
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
        console.log('✅ Subscription features table created!');
        
        // Create subscription_usage table
        console.log('📝 Creating subscription_usage table...');
        await connection.execute(`
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
        console.log('✅ Subscription usage table created!');
        
        // Create subscription_plan_configs table
        console.log('📝 Creating subscription_plan_configs table...');
        await connection.execute(`
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
        console.log('✅ Subscription plan configs table created!');
        
        // Insert default subscription features (Free plan only for now)
        console.log('📝 Inserting default subscription features...');
        await connection.execute(`
            INSERT INTO subscription_features (plan_id, feature_name, feature_limit, is_enabled) VALUES
            ('free', 'basic_homework', 5, TRUE),
            ('free', 'basic_activities', 3, TRUE),
            ('free', 'limited_storage', 100, TRUE),
            ('free', 'ads_enabled', NULL, TRUE)
            ON DUPLICATE KEY UPDATE 
                feature_limit = VALUES(feature_limit),
                is_enabled = VALUES(is_enabled)
        `);
        console.log('✅ Default features inserted!');
        
        // Insert default plan configs
        console.log('📝 Inserting default subscription plans...');
        await connection.execute(`
            INSERT INTO subscription_plan_configs (plan_id, plan_name, description, price_monthly, price_annual, trial_days, is_active, sort_order, features) VALUES
            ('free', 'Free Plan', 'Basic features with limited access', 0.00, 0.00, 0, TRUE, 1, 
             JSON_OBJECT('children_limit', 1, 'homework_limit', 5, 'activities_limit', 3, 'storage_limit', 100, 'ads_enabled', TRUE))
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
        console.log('✅ Default plans inserted!');
        
        console.log('🎉 All missing tables created successfully!');
        console.log('🚀 Your API server should now work without subscription errors!');
        
    } catch (error) {
        console.error('❌ Error creating tables:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Run the script
createMissingTables(); 