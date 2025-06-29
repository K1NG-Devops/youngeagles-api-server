-- Fix student_reports table structure
USE skydek_DB;

-- Add child_id column if it doesn't exist
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = 'skydek_DB'
    AND TABLE_NAME = 'student_reports'
    AND COLUMN_NAME = 'child_id'
);

-- Add child_id column
ALTER TABLE student_reports 
ADD COLUMN IF NOT EXISTS child_id INT AFTER id;

-- Update child_id with student_id values if it's empty
UPDATE student_reports SET child_id = student_id WHERE child_id IS NULL OR child_id = 0;

-- Add progress columns if they don't exist
ALTER TABLE student_reports 
ADD COLUMN IF NOT EXISTS academic_progress JSON DEFAULT NULL,
ADD COLUMN IF NOT EXISTS social_progress JSON DEFAULT NULL,
ADD COLUMN IF NOT EXISTS emotional_progress JSON DEFAULT NULL,
ADD COLUMN IF NOT EXISTS physical_progress JSON DEFAULT NULL,
ADD COLUMN IF NOT EXISTS teacher_comments TEXT,
ADD COLUMN IF NOT EXISTS overall_grade VARCHAR(2),
ADD COLUMN IF NOT EXISTS term VARCHAR(50),
ADD COLUMN IF NOT EXISTS academic_year VARCHAR(10);

-- Add foreign key constraint if it doesn't exist
-- (We'll check if it already exists to avoid errors)
SET @fk_exists = (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = 'skydek_DB'
    AND TABLE_NAME = 'student_reports'
    AND CONSTRAINT_NAME = 'fk_student_reports_child'
);

-- Only add the foreign key if it doesn't exist
SET @sql = IF(@fk_exists = 0, 
    'ALTER TABLE student_reports ADD CONSTRAINT fk_student_reports_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE;',
    'SELECT "Foreign key already exists" as message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create attendance table if it doesn't exist
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  child_id INT NOT NULL,
  date DATE NOT NULL,
  status ENUM('present', 'absent', 'late') NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  UNIQUE KEY unique_attendance (child_id, date)
);

-- Create homework table if it doesn't exist
CREATE TABLE IF NOT EXISTS homework (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  class_id INT,
  teacher_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES staff(id) ON DELETE SET NULL
);

-- Create submissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  homework_id INT NOT NULL,
  child_id INT NOT NULL,
  status ENUM('pending', 'submitted', 'graded', 'late') NOT NULL DEFAULT 'pending',
  grade VARCHAR(3),
  feedback TEXT,
  submitted_at TIMESTAMP NULL,
  graded_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);
