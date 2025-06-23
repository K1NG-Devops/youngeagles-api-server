-- Advanced Homework System Database Migration
-- Created: January 2025
-- Purpose: Add support for advanced homework features

-- Add columns to existing homeworks table for advanced features
ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS subject VARCHAR(50) DEFAULT 'general';
ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS difficulty_level INT DEFAULT 1;
ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS estimated_duration INT DEFAULT 15; -- minutes
ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS selected_skills JSON;
ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS custom_objectives JSON;
ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS parent_guidance TEXT;
ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS child_instructions TEXT;
ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS audio_instructions_url VARCHAR(500);
ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS visual_aids JSON;
ALTER TABLE homeworks ADD COLUMN IF NOT EXISTS assessment_criteria JSON;

-- Create skill_categories table
CREATE TABLE IF NOT EXISTS skill_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    title VARCHAR(100) NOT NULL,
    icon VARCHAR(10) NOT NULL,
    color VARCHAR(20) NOT NULL,
    description TEXT,
    age_group_min INT DEFAULT 3,
    age_group_max INT DEFAULT 6,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create skills table
CREATE TABLE IF NOT EXISTS skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    skill_key VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    difficulty_level INT DEFAULT 1,
    prerequisites JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES skill_categories(id) ON DELETE CASCADE,
    UNIQUE KEY unique_category_skill (category_id, skill_key)
);

-- Create student_skill_progress table
CREATE TABLE IF NOT EXISTS student_skill_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    skill_id INT NOT NULL,
    homework_id INT,
    proficiency_level INT DEFAULT 1, -- 1-5 scale
    demonstration_date DATE,
    teacher_notes TEXT,
    parent_notes TEXT,
    evidence_urls JSON,
    mastery_status ENUM('emerging', 'developing', 'proficient', 'advanced', 'mastery') DEFAULT 'emerging',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
    FOREIGN KEY (homework_id) REFERENCES homeworks(id) ON DELETE SET NULL,
    INDEX idx_student_skill (student_id, skill_id),
    INDEX idx_homework (homework_id)
);

-- Create weekly_reports table
CREATE TABLE IF NOT EXISTS weekly_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    homeworks_assigned INT DEFAULT 0,
    homeworks_completed INT DEFAULT 0,
    average_accuracy DECIMAL(5,2) DEFAULT 0.00,
    total_time_spent INT DEFAULT 0, -- minutes
    skills_practiced JSON,
    skills_mastered JSON,
    areas_for_improvement JSON,
    strengths_identified JSON,
    parent_action_items JSON,
    teacher_recommendations JSON,
    academic_growth_metrics JSON,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_to_parent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_week (student_id, week_start),
    UNIQUE KEY unique_student_week (student_id, week_start)
);

-- Create homework_assessments table for detailed assessment tracking
CREATE TABLE IF NOT EXISTS homework_assessments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    homework_id INT NOT NULL,
    student_id INT NOT NULL,
    completion_score INT DEFAULT 0, -- 0-100
    accuracy_score INT DEFAULT 0, -- 0-100
    creativity_score INT DEFAULT 0, -- 0-100
    effort_score INT DEFAULT 0, -- 0-100
    overall_score DECIMAL(5,2) DEFAULT 0.00,
    time_spent INT DEFAULT 0, -- minutes
    skill_demonstrations JSON,
    teacher_feedback TEXT,
    struggles_identified JSON,
    strengths_demonstrated JSON,
    next_level_ready BOOLEAN DEFAULT FALSE,
    assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assessed_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (homework_id) REFERENCES homeworks(id) ON DELETE CASCADE,
    FOREIGN KEY (assessed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_homework_student (homework_id, student_id),
    UNIQUE KEY unique_homework_student (homework_id, student_id)
);

-- Insert default skill categories
INSERT IGNORE INTO skill_categories (name, title, icon, color, description) VALUES
('mathematics', 'Mathematics', '🔢', '#3B82F6', 'Number concepts, counting, shapes, patterns'),
('literacy', 'Literacy', '📚', '#10B981', 'Letter recognition, phonics, vocabulary, pre-writing'),
('science', 'Science', '🔬', '#8B5CF6', 'Observation, nature exploration, simple experiments'),
('socialEmotional', 'Social-Emotional', '💖', '#F59E0B', 'Emotions, sharing, cooperation, empathy'),
('creative', 'Creative Arts', '🎨', '#EF4444', 'Art, music, drama, creative expression');

-- Insert default skills for Mathematics
INSERT IGNORE INTO skills (category_id, skill_key, name, description, difficulty_level) VALUES
((SELECT id FROM skill_categories WHERE name = 'mathematics'), 'counting', 'Counting & Numbers', 'Number recognition, counting sequences', 1),
((SELECT id FROM skill_categories WHERE name = 'mathematics'), 'shapes', 'Shapes & Geometry', 'Basic shapes, patterns, spatial awareness', 2),
((SELECT id FROM skill_categories WHERE name = 'mathematics'), 'measurement', 'Measurement', 'Size, length, weight comparisons', 3),
((SELECT id FROM skill_categories WHERE name = 'mathematics'), 'sorting', 'Sorting & Classification', 'Grouping objects by attributes', 2);

-- Insert default skills for Literacy
INSERT IGNORE INTO skills (category_id, skill_key, name, description, difficulty_level) VALUES
((SELECT id FROM skill_categories WHERE name = 'literacy'), 'letters', 'Letter Recognition', 'Uppercase/lowercase identification', 1),
((SELECT id FROM skill_categories WHERE name = 'literacy'), 'phonics', 'Phonics & Sounds', 'Letter sounds, beginning sounds', 2),
((SELECT id FROM skill_categories WHERE name = 'literacy'), 'vocabulary', 'Vocabulary', 'Word meaning, language development', 3),
((SELECT id FROM skill_categories WHERE name = 'literacy'), 'writing', 'Pre-Writing', 'Fine motor, tracing, letter formation', 3);

-- Insert default skills for Science
INSERT IGNORE INTO skills (category_id, skill_key, name, description, difficulty_level) VALUES
((SELECT id FROM skill_categories WHERE name = 'science'), 'observation', 'Observation', 'Using senses to explore', 1),
((SELECT id FROM skill_categories WHERE name = 'science'), 'nature', 'Nature & Environment', 'Living vs non-living, seasons', 2),
((SELECT id FROM skill_categories WHERE name = 'science'), 'experiments', 'Simple Experiments', 'Cause and effect, predictions', 4),
((SELECT id FROM skill_categories WHERE name = 'science'), 'health', 'Health & Body', 'Body parts, healthy habits', 2);

-- Insert default skills for Social-Emotional
INSERT IGNORE INTO skills (category_id, skill_key, name, description, difficulty_level) VALUES
((SELECT id FROM skill_categories WHERE name = 'socialEmotional'), 'emotions', 'Emotion Recognition', 'Identifying feelings in self/others', 2),
((SELECT id FROM skill_categories WHERE name = 'socialEmotional'), 'sharing', 'Sharing & Cooperation', 'Taking turns, working together', 3),
((SELECT id FROM skill_categories WHERE name = 'socialEmotional'), 'independence', 'Independence', 'Self-help skills, following directions', 3),
((SELECT id FROM skill_categories WHERE name = 'socialEmotional'), 'empathy', 'Empathy & Kindness', 'Understanding others\' feelings', 4);

-- Insert default skills for Creative Arts
INSERT IGNORE INTO skills (category_id, skill_key, name, description, difficulty_level) VALUES
((SELECT id FROM skill_categories WHERE name = 'creative'), 'art', 'Visual Arts', 'Drawing, coloring, creating', 1),
((SELECT id FROM skill_categories WHERE name = 'creative'), 'music', 'Music & Movement', 'Rhythm, singing, dancing', 2),
((SELECT id FROM skill_categories WHERE name = 'creative'), 'drama', 'Dramatic Play', 'Role-playing, storytelling', 3),
((SELECT id FROM skill_categories WHERE name = 'creative'), 'creativity', 'Creative Expression', 'Original thinking, imagination', 4); 