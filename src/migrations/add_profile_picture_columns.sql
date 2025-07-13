-- Add profile_picture columns to users and staff tables

-- Add profile_picture column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(255) DEFAULT NULL;

-- Add profile_picture column to staff table if it doesn't exist  
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(255) DEFAULT NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_users_profile_picture ON users(profile_picture);
CREATE INDEX IF NOT EXISTS idx_staff_profile_picture ON staff(profile_picture);
