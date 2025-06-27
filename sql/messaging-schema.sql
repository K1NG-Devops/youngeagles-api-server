-- Young Eagles Messaging System Database Schema
-- This creates the necessary tables for the comprehensive messaging functionality

-- =====================================================
-- CONVERSATIONS TABLE
-- Stores conversation metadata
-- =====================================================
CREATE TABLE IF NOT EXISTS conversations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    subject VARCHAR(255) NOT NULL,
    type ENUM('individual', 'group', 'broadcast', 'announcement') DEFAULT 'individual',
    is_group BOOLEAN DEFAULT FALSE,
    created_by INT NOT NULL,
    creator_type ENUM('admin', 'teacher', 'parent') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_creator (created_by, creator_type),
    INDEX idx_created_at (created_at),
    INDEX idx_updated_at (updated_at),
    INDEX idx_type (type)
);

-- =====================================================
-- CONVERSATION_PARTICIPANTS TABLE
-- Stores who is participating in each conversation
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    participant_id INT NOT NULL,
    participant_type ENUM('admin', 'teacher', 'parent') NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    UNIQUE KEY unique_participant (conversation_id, participant_id, participant_type),
    INDEX idx_participant (participant_id, participant_type),
    INDEX idx_conversation (conversation_id),
    INDEX idx_active (is_active)
);

-- =====================================================
-- MESSAGES TABLE
-- Stores all messages within conversations
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL,
    sender_type ENUM('admin', 'teacher', 'parent') NOT NULL,
    content TEXT NOT NULL,
    message_type ENUM('text', 'image', 'file', 'voice', 'system') DEFAULT 'text',
    attachment_url VARCHAR(500) NULL,
    is_read BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    reply_to_message_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE SET NULL,
    INDEX idx_conversation (conversation_id),
    INDEX idx_sender (sender_id, sender_type),
    INDEX idx_created_at (created_at),
    INDEX idx_is_read (is_read),
    INDEX idx_is_deleted (is_deleted),
    INDEX idx_reply_to (reply_to_message_id)
);

-- =====================================================
-- MESSAGE_REACTIONS TABLE (Optional - for future enhancement)
-- Stores emoji reactions to messages
-- =====================================================
CREATE TABLE IF NOT EXISTS message_reactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    user_type ENUM('admin', 'teacher', 'parent') NOT NULL,
    reaction_emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_reaction (message_id, user_id, user_type, reaction_emoji),
    INDEX idx_message (message_id),
    INDEX idx_user (user_id, user_type)
);

-- =====================================================
-- NOTIFICATIONS TABLE
-- Stores message notifications and read status
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    user_type ENUM('admin', 'teacher', 'parent') NOT NULL,
    type ENUM('new_message', 'new_conversation', 'broadcast', 'homework', 'announcement') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_id INT NULL, -- Can reference conversation_id, homework_id, etc.
    related_type VARCHAR(50) NULL, -- 'conversation', 'homework', etc.
    is_read BOOLEAN DEFAULT FALSE,
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    
    INDEX idx_user (user_id, user_type),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at),
    INDEX idx_priority (priority),
    INDEX idx_type (type),
    INDEX idx_related (related_id, related_type)
);

-- =====================================================
-- MESSAGE_ATTACHMENTS TABLE
-- Stores file attachments metadata
-- =====================================================
CREATE TABLE IF NOT EXISTS message_attachments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    INDEX idx_message (message_id),
    INDEX idx_uploaded_at (uploaded_at)
);

-- =====================================================
-- CONVERSATION_SETTINGS TABLE
-- Stores conversation-specific settings (mute, notifications, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    user_id INT NOT NULL,
    user_type ENUM('admin', 'teacher', 'parent') NOT NULL,
    is_muted BOOLEAN DEFAULT FALSE,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    last_read_message_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (last_read_message_id) REFERENCES messages(id) ON DELETE SET NULL,
    UNIQUE KEY unique_user_conversation (conversation_id, user_id, user_type),
    INDEX idx_conversation (conversation_id),
    INDEX idx_user (user_id, user_type)
);

-- =====================================================
-- SAMPLE DATA INSERTION
-- Insert some sample data for testing
-- =====================================================

-- Sample conversations (you can add these manually for testing)
-- INSERT INTO conversations (subject, type, created_by, creator_type) VALUES
-- ('Welcome to Little Explorers Class', 'broadcast', 1, 'admin'),
-- ('Math Homework Discussion', 'individual', 1, 'teacher'),
-- ('Parent-Teacher Conference', 'individual', 2, 'parent');

-- Sample participants
-- INSERT INTO conversation_participants (conversation_id, participant_id, participant_type) VALUES
-- (1, 1, 'parent'),  -- Parent 1 in broadcast
-- (1, 2, 'parent'),  -- Parent 2 in broadcast
-- (2, 1, 'parent'),  -- Parent 1 talking to teacher
-- (3, 1, 'teacher'); -- Teacher talking to parent

-- Sample messages
-- INSERT INTO messages (conversation_id, sender_id, sender_type, content) VALUES
-- (1, 1, 'admin', 'Welcome to the new school year! We are excited to have your children in our Little Explorers class.'),
-- (2, 1, 'teacher', 'Hi! I wanted to discuss your child''s progress on the recent math homework.'),
-- (2, 1, 'parent', 'Thank you for reaching out. I''d love to hear how my child is doing.'),
-- (3, 2, 'parent', 'I would like to schedule a parent-teacher conference to discuss my child''s development.');

-- =====================================================
-- USEFUL QUERIES FOR TESTING
-- =====================================================

-- Get all conversations for a specific user
-- SELECT c.*, cp.participant_type, cp.joined_at 
-- FROM conversations c
-- LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
-- WHERE (c.created_by = ? AND c.creator_type = ?) OR (cp.participant_id = ? AND cp.participant_type = ?)
-- ORDER BY c.updated_at DESC;

-- Get unread message count for a user
-- SELECT COUNT(*) as unread_count
-- FROM messages m
-- INNER JOIN conversations c ON m.conversation_id = c.id
-- LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
-- WHERE m.sender_id != ? AND m.sender_type != ? AND m.is_read = FALSE
-- AND ((c.created_by = ? AND c.creator_type = ?) OR (cp.participant_id = ? AND cp.participant_type = ?));

-- Get messages for a conversation with pagination
-- SELECT m.*, COALESCE(u.name, s.name) as sender_name
-- FROM messages m
-- LEFT JOIN users u ON m.sender_id = u.id AND m.sender_type = 'parent'
-- LEFT JOIN staff s ON m.sender_id = s.id AND m.sender_type IN ('admin', 'teacher')
-- WHERE m.conversation_id = ?
-- ORDER BY m.created_at DESC
-- LIMIT ? OFFSET ?;
