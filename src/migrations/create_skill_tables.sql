-- Create skill categories table
CREATE TABLE IF NOT EXISTS skill_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  title VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  color VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create skills table
CREATE TABLE IF NOT EXISTS skills (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category_id INT NOT NULL,
  difficulty_level INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES skill_categories(id)
);

-- Create student skill progress table
CREATE TABLE IF NOT EXISTS student_skill_progress (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  skill_id INT NOT NULL,
  homework_id INT,
  proficiency_level INT DEFAULT 1,
  mastery_status ENUM('emerging', 'developing', 'proficient', 'advanced', 'mastery') DEFAULT 'emerging',
  teacher_notes TEXT,
  parent_notes TEXT,
  evidence_urls JSON,
  demonstration_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES children(id),
  FOREIGN KEY (skill_id) REFERENCES skills(id),
  FOREIGN KEY (homework_id) REFERENCES homeworks(id),
  UNIQUE KEY unique_student_skill (student_id, skill_id)
);

-- Insert some default skill categories
INSERT INTO skill_categories (name, title, icon, color) VALUES
('literacy', 'Literacy & Language', 'book', '#4CAF50'),
('numeracy', 'Numeracy & Math', 'calculator', '#2196F3'),
('science', 'Science & Discovery', 'microscope', '#9C27B0'),
('creativity', 'Arts & Creativity', 'palette', '#FF9800'),
('social', 'Social & Emotional', 'heart', '#E91E63'),
('physical', 'Physical Development', 'running', '#795548'),
('cognitive', 'Cognitive Skills', 'brain', '#607D8B');

-- Insert some default skills
INSERT INTO skills (name, description, category_id, difficulty_level) VALUES
-- Literacy skills
('Letter Recognition', 'Ability to identify and name letters of the alphabet', 1, 1),
('Phonemic Awareness', 'Understanding that spoken words are made up of individual sounds', 1, 2),
('Sight Word Recognition', 'Ability to recognize common words by sight', 1, 2),
('Reading Comprehension', 'Understanding and interpreting written text', 1, 3),
('Writing Skills', 'Ability to form letters and write simple words', 1, 2),

-- Numeracy skills
('Number Recognition', 'Ability to identify and name numbers', 2, 1),
('Counting', 'Ability to count objects and understand one-to-one correspondence', 2, 1),
('Basic Addition', 'Understanding and performing simple addition', 2, 2),
('Basic Subtraction', 'Understanding and performing simple subtraction', 2, 2),
('Pattern Recognition', 'Identifying and continuing simple patterns', 2, 2),

-- Science skills
('Observation', 'Using senses to gather information about the world', 3, 1),
('Classification', 'Sorting objects based on common characteristics', 3, 2),
('Prediction', 'Making educated guesses about what might happen', 3, 2),
('Scientific Inquiry', 'Asking questions and seeking answers through exploration', 3, 3),

-- Creative skills
('Color Recognition', 'Identifying and naming colors', 4, 1),
('Drawing', 'Using tools to create pictures and express ideas', 4, 1),
('Music & Rhythm', 'Understanding and creating simple rhythms', 4, 2),
('Imaginative Play', 'Using imagination in play and storytelling', 4, 2),

-- Social skills
('Sharing', 'Willingly sharing materials and taking turns', 5, 1),
('Cooperation', 'Working together with others to achieve goals', 5, 2),
('Emotional Recognition', 'Identifying and understanding emotions', 5, 2),
('Conflict Resolution', 'Solving problems with peers appropriately', 5, 3),

-- Physical skills
('Fine Motor Skills', 'Control and coordination of small muscles', 6, 1),
('Gross Motor Skills', 'Control and coordination of large muscles', 6, 1),
('Balance', 'Maintaining balance in various positions', 6, 2),
('Hand-Eye Coordination', 'Coordinating hand movements with visual input', 6, 2),

-- Cognitive skills
('Memory', 'Remembering and recalling information', 7, 1),
('Problem Solving', 'Finding solutions to simple problems', 7, 2),
('Critical Thinking', 'Analyzing and evaluating information', 7, 3),
('Attention & Focus', 'Maintaining focus on tasks', 7, 2); 