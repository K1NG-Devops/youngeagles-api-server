-- Create staff table for admins and teachers
USE skydek_DB;

CREATE TABLE IF NOT EXISTS staff (
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

-- Insert default admin and teacher
-- Both passwords are 'King@123' (bcrypt hash)
INSERT INTO staff (name, email, password, role) VALUES
('Marrion Makunyane', 'king@youngeagles.org.za', '$2a$12$sMDqsHA9.ThWdzEY57JsAObYsM/g3SWGRzHn5OuzYT.XWEk.s7.kq', 'admin'),
('Teacher Demo', 'teacher@youngeagles.org.za', '$2a$12$sMDqsHA9.ThWdzEY57JsAObYsM/g3SWGRzHn5OuzYT.XWEk.s7.kq', 'teacher');

-- Both passwords are "King@123" 