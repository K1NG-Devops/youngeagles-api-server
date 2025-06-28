-- Drop all dependent tables first
DROP TABLE IF EXISTS message_reactions;
DROP TABLE IF EXISTS message_attachments;
DROP TABLE IF EXISTS conversation_settings;
DROP TABLE IF EXISTS conversation_participants;
DROP TABLE IF EXISTS conversation_threads;
DROP TABLE IF EXISTS messages;

-- Create messages table for direct messaging
CREATE TABLE messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sender_id INT NOT NULL,
  sender_type ENUM('parent', 'teacher', 'admin') NOT NULL,
  recipient_id INT NOT NULL,
  recipient_type ENUM('parent', 'teacher', 'admin') NOT NULL,
  message TEXT NOT NULL,
  subject VARCHAR(255),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sender (sender_id, sender_type),
  INDEX idx_recipient (recipient_id, recipient_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; 