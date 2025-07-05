-- Create notifications table for homework submissions and grading
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('homework_submission', 'homework_graded', 'grading', 'announcement', 'homework', 'message') NOT NULL,
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  user_id INT NOT NULL,
  homework_id INT NULL,
  submission_id INT NULL,
  teacher_name VARCHAR(255) NULL,
  score DECIMAL(5,2) NULL,
  auto_graded BOOLEAN DEFAULT FALSE,
  read_status BOOLEAN DEFAULT FALSE,
  read_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for better performance
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_read_status (read_status),
  INDEX idx_created_at (created_at),
  INDEX idx_homework_id (homework_id),
  INDEX idx_submission_id (submission_id)
);

-- Add some sample notifications for testing
INSERT INTO notifications (title, message, type, priority, user_id, created_at) VALUES
('Welcome to Young Eagles!', 'Thank you for joining Young Eagles. We are excited to have you on board!', 'announcement', 'low', 1, NOW()),
('System Maintenance', 'The system will undergo maintenance on Sunday from 2:00 AM to 4:00 AM.', 'announcement', 'medium', 1, NOW());
