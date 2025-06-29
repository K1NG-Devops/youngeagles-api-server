-- Simple migration to add missing columns
USE skydek_DB;

-- Add child_id column (will error if exists, but that's okay)
ALTER TABLE student_reports ADD COLUMN child_id INT AFTER id;

-- Add progress columns
ALTER TABLE student_reports ADD COLUMN academic_progress JSON DEFAULT NULL;
ALTER TABLE student_reports ADD COLUMN social_progress JSON DEFAULT NULL;
ALTER TABLE student_reports ADD COLUMN emotional_progress JSON DEFAULT NULL;
ALTER TABLE student_reports ADD COLUMN physical_progress JSON DEFAULT NULL;
ALTER TABLE student_reports ADD COLUMN teacher_comments TEXT;
ALTER TABLE student_reports ADD COLUMN overall_grade VARCHAR(2);
ALTER TABLE student_reports ADD COLUMN term VARCHAR(50);
ALTER TABLE student_reports ADD COLUMN academic_year VARCHAR(10);
