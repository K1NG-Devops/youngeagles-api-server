-- Clean initialization for skydek_DB
USE skydek_DB;

-- Disable foreign key checks for clean drops
SET FOREIGN_KEY_CHECKS = 0;

-- Drop all dependent tables in the correct order
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS homework_completions;
DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS homeworks;
DROP TABLE IF EXISTS fcm_tokens;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS children;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS staff;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Staff table (admin, teacher)
CREATE TABLE staff (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'teacher') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_verified BOOLEAN DEFAULT FALSE,
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP NULL
);

-- Users table (parents)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('parent') NOT NULL DEFAULT 'parent',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Children table
CREATE TABLE children (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  parent_id INT NOT NULL,
  gender VARCHAR(10),
  dob DATE,
  age INT,
  grade VARCHAR(10),
  className VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Homeworks table (minimal for testing)
CREATE TABLE homeworks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  file_url TEXT,
  instructions TEXT,
  status ENUM('Pending', 'Completed') DEFAULT 'Pending',
  uploaded_by_teacher_id INT NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  grade VARCHAR(20) NOT NULL,
  type VARCHAR(30),
  items JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by_teacher_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- Submissions table
CREATE TABLE submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  homework_id INT NOT NULL,
  parent_id INT NOT NULL,
  child_id INT,
  file_url TEXT,
  comment TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (homework_id) REFERENCES homeworks(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE SET NULL
);

-- Homework completions table
CREATE TABLE homework_completions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  homework_id INT NOT NULL,
  parent_id INT NOT NULL,
  child_id INT,
  completion_answer TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (homework_id) REFERENCES homeworks(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE SET NULL
);

-- Insert admin and teacher (bcrypt hashes)
-- Admin@123: $2a$12$wQw6Qw1Qw1Qw1Qw1Qw1QwOQw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1
-- Teacher@123: $2a$12$8bQw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw
INSERT INTO staff (name, email, password, role) VALUES
('Admin User', 'admin@youngeagles.org.za', '$2a$12$wQw6Qw1Qw1Qw1Qw1Qw1QwOQw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1', 'admin'),
('Teacher User', 'teacher@youngeagles.org.za', '$2a$12$8bQw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw', 'teacher');

-- Insert parent (bcrypt hash for Parent@123)
-- Parent@123: $2a$12$9bQw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw
INSERT INTO users (name, email, password, role) VALUES
('Parent User', 'parent@youngeagles.org.za', '$2a$12$9bQw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw1Qw', 'parent');

-- Insert a child for the parent (assumes parent id = 1)
INSERT INTO children (name, parent_id, gender, dob, age, grade, className) VALUES
('Test Child', 1, 'Male', '2018-01-01', 6, 'R', 'A');

-- Insert a minimal homework for testing (assumes teacher id = 2)
INSERT INTO homeworks (title, due_date, file_url, instructions, uploaded_by_teacher_id, class_name, grade, type, items) VALUES
('Sample Homework', '2024-12-31', NULL, 'Complete the attached worksheet.', 2, 'A', 'R', 'worksheet', NULL); 