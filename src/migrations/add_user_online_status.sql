-- Migration: Add user online status tracking
-- Add fields to track user online status and last seen time

ALTER TABLE users 
ADD COLUMN is_online BOOLEAN DEFAULT FALSE,
ADD COLUMN last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Create index for faster online status queries
CREATE INDEX idx_users_is_online ON users(is_online);
CREATE INDEX idx_users_last_seen ON users(last_seen);

-- Update existing users to have proper status
UPDATE users SET is_online = FALSE, last_seen = updated_at WHERE last_seen IS NULL;
