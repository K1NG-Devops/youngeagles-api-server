-- FCM Tokens Table for Push Notifications
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token TEXT NOT NULL,
  device_type VARCHAR(50) DEFAULT 'web',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_active (is_active),
  UNIQUE KEY unique_user_token (user_id, token(255))
);

-- Add foreign key constraint if users table exists
-- ALTER TABLE fcm_tokens ADD CONSTRAINT fk_fcm_tokens_user_id 
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

