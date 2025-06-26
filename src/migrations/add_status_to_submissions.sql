-- Add status column to homework_submissions table if it doesn't exist
SET @dbname = 'skydek_DB';

SET @exist = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'homework_submissions' AND COLUMN_NAME = 'status');

SET @sql = IF(@exist = 0,
  'ALTER TABLE homework_submissions ADD COLUMN status ENUM(\'pending\', \'graded\', \'late\', \'resubmitted\') DEFAULT \'pending\';',
  'SELECT "status column already exists" AS message;');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt; 