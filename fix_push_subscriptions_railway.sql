-- Migration: Fix push_subscriptions table to include userId column
-- This script adds the userId column if it doesn't exist

-- Check if userId column exists and add it if missing
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'push_subscriptions' 
    AND COLUMN_NAME = 'userId'
);

-- Add userId column if it doesn't exist
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE push_subscriptions ADD COLUMN userId VARCHAR(255) NOT NULL',
    'SELECT "userId column already exists" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify the table structure
DESCRIBE push_subscriptions;
