-- Add reset token columns to users table
ALTER TABLE users
ADD COLUMN reset_token VARCHAR(255) NULL,
ADD COLUMN reset_token_expiry TIMESTAMP NULL,
ADD INDEX idx_reset_token (reset_token); 