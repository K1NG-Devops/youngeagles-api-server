-- Update homework_submissions table to support interactive homework
ALTER TABLE homework_submissions 
ADD COLUMN IF NOT EXISTS submission_type ENUM('interactive', 'file_upload', 'text') DEFAULT 'file_upload',
ADD COLUMN IF NOT EXISTS score DECIMAL(5,2) NULL,
ADD COLUMN IF NOT EXISTS time_spent INT NULL COMMENT 'Time spent in minutes',
ADD COLUMN IF NOT EXISTS answers_data TEXT NULL COMMENT 'JSON data of answers for interactive homework',
ADD COLUMN IF NOT EXISTS additional_files TEXT NULL COMMENT 'JSON array of additional file URLs';

-- Update existing homework table to support content types
ALTER TABLE homework 
ADD COLUMN IF NOT EXISTS content_type ENUM('traditional', 'interactive', 'project') DEFAULT 'traditional',
ADD COLUMN IF NOT EXISTS assignment_type ENUM('class', 'individual') DEFAULT 'class';

-- Add indexes for new columns
ALTER TABLE homework_submissions 
ADD INDEX IF NOT EXISTS idx_submission_type (submission_type),
ADD INDEX IF NOT EXISTS idx_score (score);

ALTER TABLE homework
ADD INDEX IF NOT EXISTS idx_content_type (content_type),
ADD INDEX IF NOT EXISTS idx_assignment_type (assignment_type);
