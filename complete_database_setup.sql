-- ========================================
-- COMPLETE DATABASE SETUP SCRIPT
-- Young Eagles PWA - All Required Tables
-- ========================================

-- Create migrations tracking table
CREATE TABLE IF NOT EXISTS migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- SUBSCRIPTION SYSTEM TABLES
-- ========================================

-- Create subscriptions table
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
);

-- Create subscription_transactions table for payment history
CREATE TABLE IF NOT EXISTS subscription_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subscription_id INT NOT NULL,
    user_id INT NOT NULL,
    transaction_id VARCHAR(255) NOT NULL,
    payment_gateway VARCHAR(50) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    status ENUM('pending', 'completed', 'failed', 'refunded', 'cancelled') NOT NULL DEFAULT 'pending',
    gateway_response JSON DEFAULT NULL,
    transaction_date DATETIME NOT NULL,
    processed_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_subscription_id (subscription_id),
    INDEX idx_user_id (user_id),
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_status (status),
    INDEX idx_transaction_date (transaction_date),
    
    UNIQUE KEY unique_transaction_id (transaction_id, payment_gateway)
);

-- Create subscription_features table for feature access control
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
);

-- Create subscription_usage table for tracking feature usage
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
);

-- Create subscription_plan_configs table for plan configuration
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
);

-- ========================================
-- PAYMENT SYSTEM TABLES
-- ========================================

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    proof_image TEXT NOT NULL,
    description TEXT,
    status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    submitted_by INT NOT NULL,
    verified_by INT,
    verification_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create payment_proofs table
CREATE TABLE IF NOT EXISTS payment_proofs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    parent_id INT NOT NULL,
    child_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    file_url TEXT NOT NULL,
    payment_date DATE NOT NULL,
    reference_number VARCHAR(255),
    payment_method ENUM('bank_transfer', 'eft', 'cash', 'card') DEFAULT 'bank_transfer',
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by INT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ========================================
-- ACTIVITY SYSTEM TABLES
-- ========================================

-- Create activity assignments table
CREATE TABLE IF NOT EXISTS activity_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_id VARCHAR(100) NOT NULL,
  activity_title VARCHAR(255) NOT NULL,
  activity_type VARCHAR(50) NOT NULL DEFAULT 'interactive',
  teacher_id INT NOT NULL,
  class_id INT,
  child_id INT,
  assignment_type ENUM('individual', 'class') NOT NULL DEFAULT 'class',
  instructions TEXT,
  due_date DATETIME,
  points_possible INT DEFAULT 100,
  difficulty_level ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_teacher_id (teacher_id),
  INDEX idx_class_id (class_id),
  INDEX idx_child_id (child_id),
  INDEX idx_activity_id (activity_id),
  INDEX idx_due_date (due_date)
);

-- Create activity completions table
CREATE TABLE IF NOT EXISTS activity_completions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  child_id INT NOT NULL,
  activity_id VARCHAR(100) NOT NULL,
  status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
  score INT DEFAULT 0,
  max_score INT DEFAULT 100,
  attempts INT DEFAULT 0,
  time_spent_seconds INT DEFAULT 0,
  completion_data JSON,
  completed_at TIMESTAMP NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_assignment_id (assignment_id),
  INDEX idx_child_id (child_id),
  INDEX idx_activity_id (activity_id),
  INDEX idx_status (status),
  UNIQUE KEY unique_assignment_child (assignment_id, child_id)
);

-- ========================================
-- INSERT DEFAULT DATA
-- ========================================

-- Insert default subscription features
INSERT INTO subscription_features (plan_id, feature_name, feature_limit, is_enabled) VALUES
-- Free plan features
('free', 'basic_homework', 5, TRUE),
('free', 'basic_activities', 3, TRUE),
('free', 'limited_storage', 100, TRUE),
('free', 'ads_enabled', NULL, TRUE),

-- Student plan features
('student', 'basic_homework', NULL, TRUE),
('student', 'basic_activities', NULL, TRUE),
('student', 'unlimited_storage', NULL, TRUE),
('student', 'no_ads', NULL, TRUE),
('student', 'progress_tracking', NULL, TRUE),
('student', 'children_limit', 1, TRUE),

-- Family plan features
('family', 'basic_homework', NULL, TRUE),
('family', 'basic_activities', NULL, TRUE),
('family', 'unlimited_storage', NULL, TRUE),
('family', 'no_ads', NULL, TRUE),
('family', 'progress_tracking', NULL, TRUE),
('family', 'multiple_children', 5, TRUE),
('family', 'priority_support', NULL, TRUE),
('family', 'family_dashboard', NULL, TRUE),

-- Institution plan features
('institution', 'basic_homework', NULL, TRUE),
('institution', 'basic_activities', NULL, TRUE),
('institution', 'unlimited_storage', NULL, TRUE),
('institution', 'no_ads', NULL, TRUE),
('institution', 'progress_tracking', NULL, TRUE),
('institution', 'multiple_children', NULL, TRUE),
('institution', 'priority_support', NULL, TRUE),
('institution', 'bulk_management', NULL, TRUE),
('institution', 'analytics', NULL, TRUE),
('institution', 'api_access', NULL, TRUE),
('institution', 'custom_branding', NULL, TRUE),
('institution', 'dedicated_support', NULL, TRUE)
ON DUPLICATE KEY UPDATE 
    feature_limit = VALUES(feature_limit),
    is_enabled = VALUES(is_enabled);

-- Insert default subscription plans
INSERT INTO subscription_plan_configs (plan_id, plan_name, description, price_monthly, price_annual, trial_days, is_active, sort_order, features) VALUES
('free', 'Free Plan', 'Basic features with limited access', 0.00, 0.00, 0, TRUE, 1, 
 JSON_OBJECT('children_limit', 1, 'homework_limit', 5, 'activities_limit', 3, 'storage_limit', 100, 'ads_enabled', TRUE)
),
('student', 'Student Plan', 'Perfect for individual students', 99.00, 990.00, 7, TRUE, 2, 
 JSON_OBJECT('children_limit', 1, 'homework_limit', NULL, 'activities_limit', NULL, 'storage_limit', NULL, 'ads_enabled', FALSE)
),
('family', 'Family Plan', 'Ideal for families with multiple children', 199.00, 1990.00, 14, TRUE, 3, 
 JSON_OBJECT('children_limit', 5, 'homework_limit', NULL, 'activities_limit', NULL, 'storage_limit', NULL, 'ads_enabled', FALSE)
),
('institution', 'Institution Plan', 'Comprehensive solution for schools', 399.00, 3990.00, 30, TRUE, 4, 
 JSON_OBJECT('children_limit', NULL, 'homework_limit', NULL, 'activities_limit', NULL, 'storage_limit', NULL, 'ads_enabled', FALSE)
)
ON DUPLICATE KEY UPDATE 
    plan_name = VALUES(plan_name),
    description = VALUES(description),
    price_monthly = VALUES(price_monthly),
    price_annual = VALUES(price_annual),
    trial_days = VALUES(trial_days),
    is_active = VALUES(is_active),
    sort_order = VALUES(sort_order),
    features = VALUES(features);

-- Insert default interactive activities
INSERT INTO activity_assignments (
  activity_id, 
  activity_title, 
  activity_type, 
  teacher_id, 
  assignment_type,
  instructions,
  points_possible,
  difficulty_level
) VALUES 
('maze-robot', 'Robot Maze Navigator', 'interactive', 0, 'class', 'Guide the robot through the maze using directional commands. Learn basic programming concepts!', 100, 'easy'),
('shape-sorter', 'Shape Sorting Challenge', 'interactive', 0, 'class', 'Sort shapes by color, size, and type. Perfect for developing pattern recognition!', 80, 'easy'),
('number-sequence', 'Number Pattern Master', 'interactive', 0, 'class', 'Complete number sequences and patterns. Great for math skills!', 90, 'medium'),
('color-mixer', 'Color Mixing Lab', 'interactive', 0, 'class', 'Learn about primary and secondary colors by mixing them together!', 70, 'easy'),
('word-builder', 'Word Building Adventure', 'interactive', 0, 'class', 'Build words by arranging letters. Improve spelling and vocabulary!', 85, 'medium')
ON DUPLICATE KEY UPDATE activity_title = VALUES(activity_title);

-- Record migration execution
INSERT INTO migrations (migration_name) VALUES 
('create_subscriptions_table.sql'),
('create_payments_table.sql'),
('create_payment_proofs_table.sql'),
('create_activity_assignments.sql')
ON DUPLICATE KEY UPDATE executed_at = CURRENT_TIMESTAMP;

-- ========================================
-- SETUP COMPLETE
-- ======================================== 

CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plan_id VARCHAR(50) NOT NULL DEFAULT 'free',
  plan_name VARCHAR(100) NOT NULL DEFAULT 'Free Plan',
  status ENUM('active', 'cancelled', 'expired', 'suspended', 'trial') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
