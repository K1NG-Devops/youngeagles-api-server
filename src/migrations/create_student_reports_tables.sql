-- Student Reports System Migration

-- Student reports table for storing PDF reports and assessment data
CREATE TABLE IF NOT EXISTS student_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    teacher_id INT NOT NULL,
    report_data JSON,
    pdf_base64 LONGTEXT,
    reporting_period VARCHAR(100),
    status ENUM('draft', 'completed', 'sent_to_parent') DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student (student_id),
    INDEX idx_teacher (teacher_id),
    INDEX idx_period (reporting_period),
    INDEX idx_created (created_at)
);

-- Homework library table for storing generated homework templates
CREATE TABLE IF NOT EXISTS homework_library (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    skills JSON,
    materials JSON,
    estimated_time INT DEFAULT 15,
    assessment_area ENUM('socialEmotional', 'cognitive', 'physical', 'recommended') NOT NULL,
    student_id INT,
    teacher_id INT NOT NULL,
    status ENUM('library', 'sent', 'assigned') DEFAULT 'library',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student (student_id),
    INDEX idx_teacher (teacher_id),
    INDEX idx_assessment_area (assessment_area),
    INDEX idx_status (status)
);

-- Student assessment scores for tracking specific developmental areas
CREATE TABLE IF NOT EXISTS student_assessments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    teacher_id INT NOT NULL,
    assessment_area ENUM('socialEmotional', 'cognitive', 'physical') NOT NULL,
    assessment_type ENUM('strengths', 'growth_areas') NOT NULL,
    comments JSON,
    score INT DEFAULT 0, -- 1-5 scale
    assessment_date DATE DEFAULT (CURDATE()),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_area (student_id, assessment_area),
    INDEX idx_teacher (teacher_id),
    INDEX idx_date (assessment_date)
);

-- Real-time analytics tracking for homework and skill development
CREATE TABLE IF NOT EXISTS student_analytics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    metric_type ENUM('homework_completion', 'skill_progress', 'engagement', 'improvement') NOT NULL,
    metric_value DECIMAL(5,2),
    metric_data JSON,
    period_start DATE,
    period_end DATE,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student_metric (student_id, metric_type),
    INDEX idx_period (period_start, period_end)
);

-- Homework recommendations based on AI/algorithm analysis
CREATE TABLE IF NOT EXISTS homework_recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    homework_library_id INT,
    recommendation_reason TEXT,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    assessment_area VARCHAR(50),
    status ENUM('pending', 'accepted', 'declined', 'assigned') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP NULL,
    INDEX idx_student (student_id),
    INDEX idx_homework (homework_library_id),
    INDEX idx_status (status),
    FOREIGN KEY (homework_library_id) REFERENCES homework_library(id) ON DELETE SET NULL
);

-- Parent access to reports
CREATE TABLE IF NOT EXISTS parent_report_access (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT NOT NULL,
    parent_id INT NOT NULL,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    download_count INT DEFAULT 0,
    last_download TIMESTAMP NULL,
    INDEX idx_report (report_id),
    INDEX idx_parent (parent_id),
    FOREIGN KEY (report_id) REFERENCES student_reports(id) ON DELETE CASCADE
);

-- Insert sample data for testing
INSERT IGNORE INTO skill_categories (name, title, icon, color, description) VALUES
('socialEmotional', 'Social-Emotional', '💖', '#F59E0B', 'Emotions, sharing, cooperation, empathy'),
('cognitive', 'Cognitive', '🧠', '#3B82F6', 'Thinking, problem-solving, memory, attention'),
('physical', 'Physical', '🏃', '#10B981', 'Gross motor, fine motor, coordination, health');

-- Insert sample skills if they don't exist
INSERT IGNORE INTO skills (category_id, skill_key, name, description, difficulty_level) VALUES
((SELECT id FROM skill_categories WHERE name = 'socialEmotional'), 'empathy', 'Empathy & Understanding', 'Shows concern for others feelings', 2),
((SELECT id FROM skill_categories WHERE name = 'socialEmotional'), 'cooperation', 'Cooperation & Sharing', 'Works well with others and shares materials', 2),
((SELECT id FROM skill_categories WHERE name = 'socialEmotional'), 'emotional_regulation', 'Emotional Regulation', 'Manages emotions appropriately', 3),
((SELECT id FROM skill_categories WHERE name = 'cognitive'), 'counting', 'Counting & Numbers', 'Number recognition and counting skills', 1),
((SELECT id FROM skill_categories WHERE name = 'cognitive'), 'problem_solving', 'Problem Solving', 'Approaches challenges systematically', 3),
((SELECT id FROM skill_categories WHERE name = 'cognitive'), 'attention', 'Focus & Attention', 'Maintains attention on tasks', 2),
((SELECT id FROM skill_categories WHERE name = 'physical'), 'fine_motor', 'Fine Motor Skills', 'Hand and finger coordination', 2),
((SELECT id FROM skill_categories WHERE name = 'physical'), 'gross_motor', 'Gross Motor Skills', 'Large muscle movement and coordination', 1),
((SELECT id FROM skill_categories WHERE name = 'physical'), 'coordination', 'Balance & Coordination', 'Body awareness and balance', 2); 