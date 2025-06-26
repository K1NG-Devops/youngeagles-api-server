-- Create homework table
CREATE TABLE IF NOT EXISTS homework (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  teacher_id INT NOT NULL,
  class_id INT,
  status ENUM('draft', 'active', 'completed', 'archived') DEFAULT 'draft',
  due_date DATETIME,
  points INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES staff(id) ON DELETE CASCADE,
  INDEX idx_teacher (teacher_id),
  INDEX idx_class (class_id),
  INDEX idx_status (status)
);

-- Create homework submissions table
CREATE TABLE IF NOT EXISTS homework_submissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  homework_id INT NOT NULL,
  student_id INT NOT NULL,
  submission_text TEXT,
  attachment_url TEXT,
  status ENUM('pending', 'graded', 'late', 'resubmitted') DEFAULT 'pending',
  grade INT,
  teacher_feedback TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  graded_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
  INDEX idx_homework (homework_id),
  INDEX idx_student (student_id),
  INDEX idx_status (status)
);

-- Create homework attachments table
CREATE TABLE IF NOT EXISTS homework_attachments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  homework_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  file_size INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
  INDEX idx_homework (homework_id)
);

-- Create homework comments table
CREATE TABLE IF NOT EXISTS homework_comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  homework_id INT NOT NULL,
  submission_id INT,
  user_id INT NOT NULL,
  user_type ENUM('teacher', 'student', 'parent') NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES homework_submissions(id) ON DELETE CASCADE,
  INDEX idx_homework (homework_id),
  INDEX idx_submission (submission_id),
  INDEX idx_user (user_id, user_type)
); 