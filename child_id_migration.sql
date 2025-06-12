-- Migration to add child_id column to submissions and homework_completions tables
-- This will help differentiate homework submissions by individual children
-- Run this in your skydek_DB database

USE skydek_DB;

-- 1. Add child_id column to submissions table
ALTER TABLE submissions 
ADD COLUMN child_id INT NULL AFTER parent_id;

-- 2. Add indexes for better performance on submissions table
ALTER TABLE submissions 
ADD INDEX idx_submissions_child_id (child_id),
ADD INDEX idx_submissions_parent_child (parent_id, child_id);

-- 3. Create homework_completions table if it doesn't exist
CREATE TABLE IF NOT EXISTS homework_completions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  homework_id INT NOT NULL,
  parent_id INT NOT NULL,
  child_id INT NULL,
  completion_answer TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_homework_completions_homework_id (homework_id),
  INDEX idx_homework_completions_parent_id (parent_id),
  INDEX idx_homework_completions_child_id (child_id)
);

-- 4. If homework_completions table already exists, add child_id column
ALTER TABLE homework_completions 
ADD COLUMN IF NOT EXISTS child_id INT NULL AFTER parent_id;

-- 5. Add indexes for homework_completions table (if not already added in CREATE TABLE)
ALTER TABLE homework_completions 
ADD INDEX IF NOT EXISTS idx_homework_completions_child_id (child_id),
ADD INDEX IF NOT EXISTS idx_homework_completions_parent_child (parent_id, child_id);

-- 6. Add unique constraint to prevent duplicate completions
-- This ensures one completion per homework per parent per child
ALTER TABLE homework_completions 
ADD UNIQUE KEY unique_homework_parent_child (homework_id, parent_id, child_id);

-- 7. Verify the changes
SELECT 'Migration completed successfully!' as status;

-- 8. Show table structures to verify
DESCRIBE submissions;
DESCRIBE homework_completions;

-- 9. Show indexes to verify
SHOW INDEX FROM submissions WHERE Key_name LIKE '%child%';
SHOW INDEX FROM homework_completions WHERE Key_name LIKE '%child%';

