-- Create payment_logs table for tracking PayFast events
CREATE TABLE IF NOT EXISTS payment_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add payment tracking columns to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS payment_status ENUM('pending', 'paid', 'overdue') DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS last_payment_date DATETIME DEFAULT NULL;

-- Add payment tracking columns to subscriptions table if they don't exist
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS last_payment_date DATETIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_failed_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_payment_attempt DATETIME DEFAULT NULL;
