-- Simple Profile Picture Migration
-- Run these statements one by one if the advanced script doesn't work

-- Add profile_picture column to users table
-- (If column already exists, this will show an error but won't break anything)
ALTER TABLE users ADD COLUMN profile_picture VARCHAR(255) DEFAULT NULL;

-- Add profile_picture column to staff table
-- (If column already exists, this will show an error but won't break anything)
ALTER TABLE staff ADD COLUMN profile_picture VARCHAR(255) DEFAULT NULL;

-- Verify the columns were added
SHOW COLUMNS FROM users LIKE 'profile_picture';
SHOW COLUMNS FROM staff LIKE 'profile_picture'; 