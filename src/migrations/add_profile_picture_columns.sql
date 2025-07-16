-- Add profile_picture columns to users and staff tables

-- Add profile_picture column to users table
ALTER TABLE users 
ADD COLUMN profile_picture VARCHAR(255) DEFAULT NULL;

-- Add profile_picture column to staff table
ALTER TABLE staff 
ADD COLUMN profile_picture VARCHAR(255) DEFAULT NULL;

-- Add index for better performance
CREATE INDEX idx_users_profile_picture ON users(profile_picture);
CREATE INDEX idx_staff_profile_picture ON staff(profile_picture);
