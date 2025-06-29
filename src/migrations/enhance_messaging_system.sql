-- Enhanced Messaging System Migration
-- Adds state-of-the-art messaging features

-- Add enhanced columns to messages table
ALTER TABLE messages 
ADD COLUMN thread_id INT NULL,
ADD COLUMN reply_to_message_id INT NULL,
ADD COLUMN message_status ENUM('sent', 'delivered', 'read') DEFAULT 'sent',
ADD COLUMN read_at TIMESTAMP NULL,
ADD COLUMN delivered_at TIMESTAMP NULL,
ADD COLUMN edited_at TIMESTAMP NULL,
ADD COLUMN is_edited BOOLEAN DEFAULT FALSE,
ADD COLUMN attachment_type ENUM('image', 'file', 'voice', 'video') NULL,
ADD COLUMN attachment_size BIGINT NULL,
ADD COLUMN voice_duration INT NULL,
ADD COLUMN message_priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
ADD FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE SET NULL;

-- Create message reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  user_type ENUM('parent', 'teacher', 'admin') NOT NULL,
  reaction_emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_reaction (message_id, user_id, user_type, reaction_emoji),
  INDEX idx_message_reactions (message_id)
);

-- Create user presence table for online/offline status
CREATE TABLE IF NOT EXISTS user_presence (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  user_type ENUM('parent', 'teacher', 'admin') NOT NULL,
  status ENUM('online', 'away', 'busy', 'offline') DEFAULT 'offline',
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  device_info VARCHAR(255) NULL,
  socket_id VARCHAR(100) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_presence (user_id, user_type),
  INDEX idx_status (status),
  INDEX idx_last_seen (last_seen)
);

-- Create typing indicators table
CREATE TABLE IF NOT EXISTS typing_indicators (
  id INT PRIMARY KEY AUTO_INCREMENT,
  conversation_id VARCHAR(100) NOT NULL,
  user_id INT NOT NULL,
  user_type ENUM('parent', 'teacher', 'admin') NOT NULL,
  is_typing BOOLEAN DEFAULT TRUE,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  UNIQUE KEY unique_typing (conversation_id, user_id, user_type),
  INDEX idx_conversation_typing (conversation_id),
  INDEX idx_expires (expires_at)
);

-- Create message search index table
CREATE TABLE IF NOT EXISTS message_search_index (
  id INT PRIMARY KEY AUTO_INCREMENT,
  message_id INT NOT NULL,
  search_text TEXT NOT NULL,
  user_id INT NOT NULL,
  user_type ENUM('parent', 'teacher', 'admin') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FULLTEXT KEY ft_search_text (search_text),
  INDEX idx_user_search (user_id, user_type)
);

-- Create message delivery tracking
CREATE TABLE IF NOT EXISTS message_delivery (
  id INT PRIMARY KEY AUTO_INCREMENT,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  user_type ENUM('parent', 'teacher', 'admin') NOT NULL,
  delivery_status ENUM('sent', 'delivered', 'read', 'failed') DEFAULT 'sent',
  delivered_at TIMESTAMP NULL,
  read_at TIMESTAMP NULL,
  device_type VARCHAR(50) NULL,
  push_notification_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  UNIQUE KEY unique_message_delivery (message_id, user_id, user_type),
  INDEX idx_delivery_status (delivery_status),
  INDEX idx_message_delivery (message_id)
);

-- Create smart notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  user_type ENUM('parent', 'teacher', 'admin') NOT NULL,
  notification_type ENUM('message', 'homework', 'announcement', 'urgent') NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE,
  vibration_enabled BOOLEAN DEFAULT TRUE,
  quiet_hours_start TIME NULL,
  quiet_hours_end TIME NULL,
  weekend_notifications BOOLEAN DEFAULT TRUE,
  priority_threshold ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_notification_type (user_id, user_type, notification_type),
  INDEX idx_user_preferences (user_id, user_type)
);

-- Create conversation settings for enhanced features
CREATE TABLE IF NOT EXISTS conversation_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  conversation_id VARCHAR(100) NOT NULL,
  user_id INT NOT NULL,
  user_type ENUM('parent', 'teacher', 'admin') NOT NULL,
  is_muted BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  read_receipts_enabled BOOLEAN DEFAULT TRUE,
  typing_indicators_enabled BOOLEAN DEFAULT TRUE,
  sound_notifications BOOLEAN DEFAULT TRUE,
  custom_notification_sound VARCHAR(255) NULL,
  last_read_message_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_conversation_user (conversation_id, user_id, user_type),
  INDEX idx_conversation_settings (conversation_id),
  INDEX idx_user_settings (user_id, user_type)
);

-- Add indexes for better performance
ALTER TABLE messages 
ADD INDEX idx_thread_id (thread_id),
ADD INDEX idx_reply_to (reply_to_message_id),
ADD INDEX idx_message_status (message_status),
ADD INDEX idx_read_at (read_at),
ADD INDEX idx_attachment_type (attachment_type),
ADD INDEX idx_priority (message_priority);

-- Create view for enhanced conversation list
CREATE OR REPLACE VIEW enhanced_conversations AS
SELECT 
  m.id as message_id,
  m.sender_id,
  m.sender_type,
  m.recipient_id,
  m.recipient_type,
  m.message,
  m.subject,
  m.message_status,
  m.read_at,
  m.created_at,
  CASE 
    WHEN m.sender_type = 'parent' THEN (SELECT name FROM users WHERE id = m.sender_id)
    ELSE (SELECT name FROM staff WHERE id = m.sender_id)
  END as sender_name,
  CASE 
    WHEN m.recipient_type = 'parent' THEN (SELECT name FROM users WHERE id = m.recipient_id)
    ELSE (SELECT name FROM staff WHERE id = m.recipient_id)
  END as recipient_name,
  (SELECT COUNT(*) FROM message_reactions WHERE message_id = m.id) as reaction_count,
  (SELECT status FROM user_presence WHERE user_id = m.sender_id AND user_type = m.sender_type) as sender_status,
  (SELECT status FROM user_presence WHERE user_id = m.recipient_id AND user_type = m.recipient_type) as recipient_status
FROM messages m
ORDER BY m.created_at DESC;

-- Insert default notification preferences for existing users
INSERT IGNORE INTO notification_preferences (user_id, user_type, notification_type, enabled)
SELECT id, 'parent', 'message', TRUE FROM users WHERE role = 'parent'
UNION ALL
SELECT id, 'parent', 'homework', TRUE FROM users WHERE role = 'parent'
UNION ALL
SELECT id, 'parent', 'announcement', TRUE FROM users WHERE role = 'parent'
UNION ALL
SELECT id, 'parent', 'urgent', TRUE FROM users WHERE role = 'parent'
UNION ALL
SELECT id, 'teacher', 'message', TRUE FROM staff WHERE role = 'teacher'
UNION ALL
SELECT id, 'teacher', 'homework', TRUE FROM staff WHERE role = 'teacher'
UNION ALL
SELECT id, 'teacher', 'announcement', TRUE FROM staff WHERE role = 'teacher'
UNION ALL
SELECT id, 'teacher', 'urgent', TRUE FROM staff WHERE role = 'teacher'
UNION ALL
SELECT id, 'admin', 'message', TRUE FROM staff WHERE role = 'admin'
UNION ALL
SELECT id, 'admin', 'homework', TRUE FROM staff WHERE role = 'admin'
UNION ALL
SELECT id, 'admin', 'announcement', TRUE FROM staff WHERE role = 'admin'
UNION ALL
SELECT id, 'admin', 'urgent', TRUE FROM staff WHERE role = 'admin';

-- Create triggers for automatic message indexing
DELIMITER $$

CREATE TRIGGER message_search_insert 
AFTER INSERT ON messages
FOR EACH ROW
BEGIN
  INSERT INTO message_search_index (message_id, search_text, user_id, user_type)
  VALUES (NEW.id, CONCAT(IFNULL(NEW.subject, ''), ' ', NEW.message), NEW.sender_id, NEW.sender_type);
END$$

CREATE TRIGGER message_search_update
AFTER UPDATE ON messages
FOR EACH ROW
BEGIN
  UPDATE message_search_index 
  SET search_text = CONCAT(IFNULL(NEW.subject, ''), ' ', NEW.message)
  WHERE message_id = NEW.id;
END$$

DELIMITER ;

-- Create cleanup procedures for old data
DELIMITER $$

CREATE PROCEDURE CleanupTypingIndicators()
BEGIN
  DELETE FROM typing_indicators WHERE expires_at < NOW();
END$$

CREATE PROCEDURE CleanupOldPresence()
BEGIN
  UPDATE user_presence 
  SET status = 'offline' 
  WHERE last_seen < DATE_SUB(NOW(), INTERVAL 5 MINUTE) 
  AND status != 'offline';
END$$

DELIMITER ;

-- Create events for automatic cleanup
SET GLOBAL event_scheduler = ON;

CREATE EVENT IF NOT EXISTS cleanup_typing_indicators
ON SCHEDULE EVERY 1 MINUTE
DO CALL CleanupTypingIndicators();

CREATE EVENT IF NOT EXISTS cleanup_old_presence
ON SCHEDULE EVERY 2 MINUTE
DO CALL CleanupOldPresence(); 