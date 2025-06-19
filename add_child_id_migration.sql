-- Migration to add child_id column to submissions and homework_completions tables
-- This will help differentiate homework submissions by individual children

USE skydek_DB;

-- Add child_id column to submissions table
ALTER TABLE submissions 
ADD COLUMN child_id INT NULL AFTER parent_id,
ADD INDEX idx_submissions_child_id (child_id),
ADD INDEX idx_submissions_parent_child (parent_id, child_id);

-- Add child_id column to homework_completions table (create table if it doesn't exist)
CREATE TABLE IF NOT EXISTS homework_completions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  homework_id INT NOT NULL,
  parent_id INT NOT NULL,
  child_id INT NULL,
  completion_answer TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_homework_parent_child (homework_id, parent_id, child_id),
  INDEX idx_homework_completions_homework_id (homework_id),
  INDEX idx_homework_completions_parent_id (parent_id),
  INDEX idx_homework_completions_child_id (child_id)
);

-- If the table already exists, add the child_id column
ALTER TABLE homework_completions 
ADD COLUMN IF NOT EXISTS child_id INT NULL AFTER parent_id;

-- Add indexes for better performance
ALTER TABLE homework_completions 
ADD INDEX IF NOT EXISTS idx_homework_completions_child_id (child_id),
ADD INDEX IF NOT EXISTS idx_homework_completions_parent_child (parent_id, child_id);

-- Update the unique constraint to include child_id
ALTER TABLE homework_completions 
DROP INDEX IF EXISTS unique_homework_parent,
ADD UNIQUE KEY IF NOT EXISTS unique_homework_parent_child (homework_id, parent_id, child_id);

SELECT 'Migration completed successfully' as status;

