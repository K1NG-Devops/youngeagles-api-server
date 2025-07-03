-- Create activity assignments table
CREATE TABLE IF NOT EXISTS activity_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_id VARCHAR(100) NOT NULL,
  activity_title VARCHAR(255) NOT NULL,
  activity_type VARCHAR(50) NOT NULL DEFAULT 'interactive',
  teacher_id INT NOT NULL,
  class_id INT,
  child_id INT,
  assignment_type ENUM('individual', 'class') NOT NULL DEFAULT 'class',
  instructions TEXT,
  due_date DATETIME,
  points_possible INT DEFAULT 100,
  difficulty_level ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_teacher_id (teacher_id),
  INDEX idx_class_id (class_id),
  INDEX idx_child_id (child_id),
  INDEX idx_activity_id (activity_id),
  INDEX idx_due_date (due_date)
);

-- Create activity completions table
CREATE TABLE IF NOT EXISTS activity_completions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  child_id INT NOT NULL,
  activity_id VARCHAR(100) NOT NULL,
  status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
  score INT DEFAULT 0,
  max_score INT DEFAULT 100,
  attempts INT DEFAULT 0,
  time_spent_seconds INT DEFAULT 0,
  completion_data JSON,
  completed_at TIMESTAMP NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES activity_assignments(id) ON DELETE CASCADE,
  INDEX idx_assignment_id (assignment_id),
  INDEX idx_child_id (child_id),
  INDEX idx_activity_id (activity_id),
  INDEX idx_status (status),
  UNIQUE KEY unique_assignment_child (assignment_id, child_id)
);

-- Insert default interactive activities
INSERT IGNORE INTO activity_assignments (
  activity_id, 
  activity_title, 
  activity_type, 
  teacher_id, 
  assignment_type,
  instructions,
  points_possible,
  difficulty_level
) VALUES 
('maze-robot', 'Robot Maze Navigator', 'interactive', 0, 'class', 'Guide the robot through the maze using directional commands. Learn basic programming concepts!', 100, 'easy'),
('shape-sorter', 'Shape Sorting Challenge', 'interactive', 0, 'class', 'Sort shapes by color, size, and type. Perfect for developing pattern recognition!', 80, 'easy'),
('number-sequence', 'Number Pattern Master', 'interactive', 0, 'class', 'Complete number sequences and patterns. Great for math skills!', 90, 'medium'),
('color-mixer', 'Color Mixing Lab', 'interactive', 0, 'class', 'Learn about primary and secondary colors by mixing them together!', 70, 'easy'),
('word-builder', 'Word Building Adventure', 'interactive', 0, 'class', 'Build words by arranging letters. Improve spelling and vocabulary!', 85, 'medium'); 