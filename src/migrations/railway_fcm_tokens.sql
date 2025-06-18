-- FCM Tokens Migration for railway (Admin/Teachers Database)
-- Run this script in your railway database

USE railway;

-- Create FCM tokens table for teachers and admins
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT 'References users.id in railway database',
  user_type ENUM('teacher', 'admin') DEFAULT 'teacher',
  token TEXT NOT NULL,
  device_type VARCHAR(50) DEFAULT 'web',
  device_info JSON NULL COMMENT 'Store browser/device information',
  is_active BOOLEAN DEFAULT TRUE,
  last_used TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_user_id (user_id),
  INDEX idx_user_type (user_type),
  INDEX idx_active (is_active),
  INDEX idx_last_used (last_used),
  
  -- Ensure unique tokens per user
  UNIQUE KEY unique_user_token (user_id, user_type, token(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key constraint to users table
ALTER TABLE fcm_tokens 
ADD CONSTRAINT fk_fcm_tokens_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create notifications table for teachers/admins if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  user_type ENUM('teacher', 'admin') DEFAULT 'teacher',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'general' COMMENT 'homework_submission, attendance, admin_notice, etc.',
  related_id INT NULL COMMENT 'ID of related homework, event, etc.',
  related_type VARCHAR(50) NULL COMMENT 'homework, event, attendance, etc.',
  is_read BOOLEAN DEFAULT FALSE,
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_user_id (user_id),
  INDEX idx_user_type (user_type),
  INDEX idx_is_read (is_read),
  INDEX idx_type (type),
  INDEX idx_priority (priority),
  INDEX idx_created_at (created_at),
  
  -- Foreign key
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert some sample data for testing (optional)
-- You can remove this section if you don't want test data
/*
INSERT INTO notifications (user_id, user_type, title, message, type, priority) VALUES
(1, 'teacher', 'Welcome to Young Eagles Teacher Portal', 'Welcome to the teacher dashboard!', 'welcome', 'medium'),
(1, 'admin', 'Admin Dashboard Ready', 'Your admin dashboard is now ready for use.', 'welcome', 'medium');
*/

-- Show table structure
DESCRIBE fcm_tokens;
DESCRIBE notifications;

-- Show any existing data
SELECT COUNT(*) as fcm_tokens_count FROM fcm_tokens;
SELECT COUNT(*) as notifications_count FROM notifications;

SELECT 'railway FCM tokens migration completed successfully!' as status;

