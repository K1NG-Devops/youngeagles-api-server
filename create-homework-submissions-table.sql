-- Create homework_submissions table
CREATE TABLE IF NOT EXISTS homework_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  homework_id INT NOT NULL,
  child_id INT NOT NULL,
  submitted_at DATETIME NOT NULL,
  file_url VARCHAR(500),
  grade DECIMAL(5,2),
  feedback TEXT,
  graded_at DATETIME,
  status ENUM('submitted', 'graded', 'returned') DEFAULT 'submitted',
  created_at TIMESTAMP DEFAULT CURRENT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  

  
  -- Unique constraint to prevent duplicate submissions
  UNIQUE KEY unique_submission (homework_id, child_id),
  
  -- Indexes for better performance
  INDEX idx_homework_id (homework_id),
  INDEX idx_child_id (child_id),
  INDEX idx_status (status),
  INDEX idx_submitted_at (submitted_at)
); 