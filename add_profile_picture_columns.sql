-- Add profile_picture column to users table (MySQL compatible)
-- This approach safely adds the column only if it doesn't exist

-- Check and add profile_picture to users table
SET @sql = (
    SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN 
                'ALTER TABLE users ADD COLUMN profile_picture VARCHAR(255) DEFAULT NULL;'
            ELSE 
                'SELECT "Column profile_picture already exists in users table" as message;'
        END
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'profile_picture'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add profile_picture to staff table
SET @sql = (
    SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN 
                'ALTER TABLE staff ADD COLUMN profile_picture VARCHAR(255) DEFAULT NULL;'
            ELSE 
                'SELECT "Column profile_picture already exists in staff table" as message;'
        END
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'staff' 
    AND COLUMN_NAME = 'profile_picture'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Show the updated table structures
DESCRIBE users;
DESCRIBE staff; 

ALTER TABLE users ADD COLUMN profile_picture VARCHAR(255) DEFAULT NULL;
ALTER TABLE staff ADD COLUMN profile_picture VARCHAR(255) DEFAULT NULL;