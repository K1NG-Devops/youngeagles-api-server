-- Create messaging system tables

-- Messages table for storing conversations
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  sender_type ENUM('parent', 'teacher', 'admin') NOT NULL,
  recipient_id INT NOT NULL,
  recipient_type ENUM('parent', 'teacher', 'admin') NOT NULL,
  subject VARCHAR(255),
  message TEXT NOT NULL,
  message_type ENUM('text', 'homework', 'notification', 'alert') DEFAULT 'text',
  is_read BOOLEAN DEFAULT FALSE,
  is_urgent BOOLEAN DEFAULT FALSE,
  parent_message_id INT NULL, -- For replies/threading
  attachment_url VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sender (sender_id, sender_type),
  INDEX idx_recipient (recipient_id, recipient_type),
  INDEX idx_read_status (is_read),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- Message participants table for group conversations
CREATE TABLE IF NOT EXISTS message_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  user_type ENUM('parent', 'teacher', 'admin') NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  UNIQUE KEY unique_participant (message_id, user_id, user_type)
);

-- Notifications table for real-time notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_type ENUM('parent', 'teacher', 'admin') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  notification_type ENUM('message', 'homework', 'attendance', 'announcement', 'system') NOT NULL,
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  is_read BOOLEAN DEFAULT FALSE,
  action_url VARCHAR(500) NULL,
  related_id INT NULL, -- ID of related entity (homework, message, etc.)
  fcm_sent BOOLEAN DEFAULT FALSE,
  fcm_sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id, user_type),
  INDEX idx_read_status (is_read),
  INDEX idx_type (notification_type),
  INDEX idx_priority (priority),
  INDEX idx_created_at (created_at)
);

-- Conversation threads table for organizing related messages
CREATE TABLE IF NOT EXISTS conversation_threads (
  id INT PRIMARY KEY AUTO_INCREMENT,
  subject VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Thread participants table
CREATE TABLE IF NOT EXISTS thread_participants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  thread_id INT NOT NULL,
  user_id INT NOT NULL,
  user_type ENUM('parent', 'teacher', 'admin') NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_read_at TIMESTAMP NULL,
  FOREIGN KEY (thread_id) REFERENCES conversation_threads(id) ON DELETE CASCADE,
  UNIQUE KEY unique_participant (thread_id, user_id, user_type)
);

-- Create message attachments table
CREATE TABLE IF NOT EXISTS message_attachments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  message_id INT NOT NULL,
  file_url VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  file_name VARCHAR(255),
  file_size INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Create message reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  user_type ENUM('parent', 'teacher', 'admin') NOT NULL,
  reaction VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  UNIQUE KEY unique_reaction (message_id, user_id, user_type)
);

-- Create indexes for better performance
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id, sender_type);
CREATE INDEX idx_thread_participants_user ON thread_participants(user_id, user_type);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_conversations_updated_at ON conversation_threads(updated_at);

