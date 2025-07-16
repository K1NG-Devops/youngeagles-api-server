-- Create push_subscriptions table for web push notifications
-- This table stores user push notification subscriptions for the PWA

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    userType ENUM('parent', 'teacher', 'student', 'admin') NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_userId (userId),
    INDEX idx_userType (userType),
    INDEX idx_isActive (isActive),
    INDEX idx_user_active (userId, isActive),
    
    UNIQUE KEY unique_user_endpoint (userId, endpoint(255))
);

-- Insert migration record
INSERT INTO migrations (migration_name) VALUES ('create_push_subscriptions_table')
ON DUPLICATE KEY UPDATE migration_name = migration_name;

-- Display success message
SELECT 'Push subscriptions table created successfully' AS status;
