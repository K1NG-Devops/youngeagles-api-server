-- First check if columns exist and add them if they don't
SET @dbname = 'skydek_DB';

SET @child_id_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname
  AND TABLE_NAME = 'student_reports'
  AND COLUMN_NAME = 'child_id'
);

SET @academic_progress_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname
  AND TABLE_NAME = 'student_reports'
  AND COLUMN_NAME = 'academic_progress'
);

SET @social_progress_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname
  AND TABLE_NAME = 'student_reports'
  AND COLUMN_NAME = 'social_progress'
);

SET @emotional_progress_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname
  AND TABLE_NAME = 'student_reports'
  AND COLUMN_NAME = 'emotional_progress'
);

SET @physical_progress_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname
  AND TABLE_NAME = 'student_reports'
  AND COLUMN_NAME = 'physical_progress'
);

SET @teacher_comments_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname
  AND TABLE_NAME = 'student_reports'
  AND COLUMN_NAME = 'teacher_comments'
);

SET @overall_grade_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname
  AND TABLE_NAME = 'student_reports'
  AND COLUMN_NAME = 'overall_grade'
);

SET @term_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname
  AND TABLE_NAME = 'student_reports'
  AND COLUMN_NAME = 'term'
);

SET @academic_year_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname
  AND TABLE_NAME = 'student_reports'
  AND COLUMN_NAME = 'academic_year'
);

-- Add columns that don't exist
SET @sql = '';

IF @child_id_exists = 0 THEN
  SET @sql = CONCAT(@sql, 'ADD COLUMN child_id INT NOT NULL AFTER id, ');
END IF;

IF @academic_progress_exists = 0 THEN
  SET @sql = CONCAT(@sql, 'ADD COLUMN academic_progress JSON DEFAULT NULL, ');
END IF;

IF @social_progress_exists = 0 THEN
  SET @sql = CONCAT(@sql, 'ADD COLUMN social_progress JSON DEFAULT NULL, ');
END IF;

IF @emotional_progress_exists = 0 THEN
  SET @sql = CONCAT(@sql, 'ADD COLUMN emotional_progress JSON DEFAULT NULL, ');
END IF;

IF @physical_progress_exists = 0 THEN
  SET @sql = CONCAT(@sql, 'ADD COLUMN physical_progress JSON DEFAULT NULL, ');
END IF;

IF @teacher_comments_exists = 0 THEN
  SET @sql = CONCAT(@sql, 'ADD COLUMN teacher_comments TEXT, ');
END IF;

IF @overall_grade_exists = 0 THEN
  SET @sql = CONCAT(@sql, 'ADD COLUMN overall_grade VARCHAR(2), ');
END IF;

IF @term_exists = 0 THEN
  SET @sql = CONCAT(@sql, 'ADD COLUMN term VARCHAR(50), ');
END IF;

IF @academic_year_exists = 0 THEN
  SET @sql = CONCAT(@sql, 'ADD COLUMN academic_year VARCHAR(10), ');
END IF;

-- Remove trailing comma and space if any columns need to be added
IF LENGTH(@sql) > 0 THEN
  SET @sql = SUBSTRING(@sql, 1, LENGTH(@sql) - 2);
  SET @sql = CONCAT('ALTER TABLE student_reports ', @sql);
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
END IF;

-- Add foreign key if it doesn't exist
SELECT COUNT(*) INTO @fk_exists
FROM information_schema.TABLE_CONSTRAINTS 
WHERE TABLE_SCHEMA = @dbname
AND TABLE_NAME = 'student_reports'
AND CONSTRAINT_NAME = 'fk_student_reports_child';

IF @fk_exists = 0 THEN
  ALTER TABLE student_reports
    ADD CONSTRAINT fk_student_reports_child
    FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE;
END IF;

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