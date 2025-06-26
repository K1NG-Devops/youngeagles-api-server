-- Add professional fields to staff table if they don't exist
SET @dbname = 'skydek_DB';

-- phone
SET @exist_phone = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'phone');
SET @sql_phone = IF(@exist_phone = 0, 'ALTER TABLE staff ADD COLUMN phone VARCHAR(20) NULL;', 'SELECT "phone column already exists" AS message;');
PREPARE stmt FROM @sql_phone;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- qualification
SET @exist_qual = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'qualification');
SET @sql_qual = IF(@exist_qual = 0, 'ALTER TABLE staff ADD COLUMN qualification VARCHAR(255) NULL;', 'SELECT "qualification column already exists" AS message;');
PREPARE stmt FROM @sql_qual;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- experience_years
SET @exist_exp = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'experience_years');
SET @sql_exp = IF(@exist_exp = 0, 'ALTER TABLE staff ADD COLUMN experience_years INT NULL;', 'SELECT "experience_years column already exists" AS message;');
PREPARE stmt FROM @sql_exp;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- specialization
SET @exist_spec = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'specialization');
SET @sql_spec = IF(@exist_spec = 0, 'ALTER TABLE staff ADD COLUMN specialization VARCHAR(255) NULL;', 'SELECT "specialization column already exists" AS message;');
PREPARE stmt FROM @sql_spec;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- emergency_contact_name
SET @exist_ecn = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'emergency_contact_name');
SET @sql_ecn = IF(@exist_ecn = 0, 'ALTER TABLE staff ADD COLUMN emergency_contact_name VARCHAR(255) NULL;', 'SELECT "emergency_contact_name column already exists" AS message;');
PREPARE stmt FROM @sql_ecn;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- emergency_contact_phone
SET @exist_ecp = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'emergency_contact_phone');
SET @sql_ecp = IF(@exist_ecp = 0, 'ALTER TABLE staff ADD COLUMN emergency_contact_phone VARCHAR(20) NULL;', 'SELECT "emergency_contact_phone column already exists" AS message;');
PREPARE stmt FROM @sql_ecp;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- bio
SET @exist_bio = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'bio');
SET @sql_bio = IF(@exist_bio = 0, 'ALTER TABLE staff ADD COLUMN bio TEXT NULL;', 'SELECT "bio column already exists" AS message;');
PREPARE stmt FROM @sql_bio;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- profile_picture
SET @exist_pic = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'profile_picture');
SET @sql_pic = IF(@exist_pic = 0, 'ALTER TABLE staff ADD COLUMN profile_picture TEXT NULL;', 'SELECT "profile_picture column already exists" AS message;');
PREPARE stmt FROM @sql_pic;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- updated_at
SET @exist_updated = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'updated_at');
SET @sql_updated = IF(@exist_updated = 0, 'ALTER TABLE staff ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;', 'SELECT "updated_at column already exists" AS message;');
PREPARE stmt FROM @sql_updated;
EXECUTE stmt;
DEALLOCATE PREPARE stmt; 