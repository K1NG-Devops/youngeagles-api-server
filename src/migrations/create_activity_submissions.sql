-- Create activity submissions table
CREATE TABLE IF NOT EXISTS activity_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_type VARCHAR(50) NOT NULL,
  activity_id VARCHAR(100) NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  score INT NOT NULL DEFAULT 0,
  time_elapsed INT NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  commands_used INT NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  difficulty VARCHAR(50) NOT NULL DEFAULT 'easy',
  metadata JSON DEFAULT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user (user_id, user_type),
  INDEX idx_activity (activity_id, activity_type),
  INDEX idx_submitted_at (submitted_at)
);

-- Create student progress table
CREATE TABLE IF NOT EXISTS student_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  activity_id VARCHAR(100) NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  score INT NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  last_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_student_activity (student_id, activity_id, activity_type),
  INDEX idx_student (student_id),
  INDEX idx_activity (activity_id, activity_type),
  INDEX idx_last_attempt (last_attempt_at)
); 