-- Enhanced Homework Fields Migration for YoungEagles API
-- This migration adds the new fields needed for rich homework data

-- Add enhanced homework fields to the homework table
-- Note: If columns already exist, these will fail but the migration will continue
ALTER TABLE homework ADD COLUMN objectives JSON COMMENT 'Learning objectives array';
ALTER TABLE homework ADD COLUMN activities JSON COMMENT 'Activities to complete array';
ALTER TABLE homework ADD COLUMN materials JSON COMMENT 'Required materials array';
ALTER TABLE homework ADD COLUMN parent_guidance TEXT COMMENT 'Guidance for parents';
ALTER TABLE homework ADD COLUMN caps_alignment VARCHAR(255) COMMENT 'CAPS curriculum alignment';
ALTER TABLE homework ADD COLUMN duration INT DEFAULT 30 COMMENT 'Estimated duration in minutes';
ALTER TABLE homework ADD COLUMN difficulty ENUM('easy', 'intermediate', 'hard') DEFAULT 'intermediate' COMMENT 'Difficulty level';
ALTER TABLE homework ADD COLUMN term VARCHAR(50) COMMENT 'Academic term';

-- Create indexes for better performance
-- Note: MariaDB/MySQL might not support IF NOT EXISTS for indexes
CREATE INDEX idx_homework_difficulty ON homework(difficulty);
CREATE INDEX idx_homework_caps ON homework(caps_alignment);
CREATE INDEX idx_homework_duration ON homework(duration);

-- Update existing records with sample data based on subject
UPDATE homework 
SET 
    objectives = JSON_ARRAY(
        'Understand key concepts and principles',
        'Apply learning through practical exercises',
        'Develop critical thinking skills'
    ),
    activities = JSON_ARRAY(
        'Read assigned materials carefully',
        'Complete practice exercises',
        'Prepare for class discussion'
    ),
    materials = JSON_ARRAY(
        'Textbook relevant chapters',
        'Worksheet packet',
        'Calculator (if needed)'
    ),
    parent_guidance = 'Encourage your child to work through problems step-by-step. Help them organize their workspace and check their work before submission.',
    caps_alignment = CONCAT('CAPS Grade ', COALESCE(grade, '4'), ' - ', COALESCE(subject, 'General')),
    duration = 30,
    difficulty = 'intermediate',
    term = '2'
WHERE objectives IS NULL;

-- Update Mathematics homework with specific content
UPDATE homework 
SET 
    objectives = JSON_ARRAY(
        'Master basic arithmetic operations',
        'Solve word problems accurately',
        'Apply math concepts to real-world scenarios'
    ),
    activities = JSON_ARRAY(
        'Complete 10 addition problems',
        'Solve 5 word problems',
        'Practice with counting objects'
    ),
    materials = JSON_ARRAY(
        'Math textbook Chapter 3',
        'Counting manipulatives',
        'Calculator',
        'Practice worksheet'
    ),
    parent_guidance = 'Use everyday objects for counting. Help your child visualize math problems with real items like toys or snacks.',
    difficulty = 'easy',
    duration = 25
WHERE subject LIKE '%Math%' AND objectives IS NOT NULL;

-- Update English homework with specific content
UPDATE homework 
SET 
    objectives = JSON_ARRAY(
        'Improve reading comprehension',
        'Expand vocabulary',
        'Practice writing skills'
    ),
    activities = JSON_ARRAY(
        'Read assigned story',
        'Complete comprehension questions',
        'Write summary paragraph'
    ),
    materials = JSON_ARRAY(
        'Reading book',
        'Vocabulary worksheet',
        'Writing paper',
        'Dictionary'
    ),
    parent_guidance = 'Read together with your child. Ask questions about the story and help them sound out difficult words.',
    difficulty = 'intermediate',
    duration = 35
WHERE subject LIKE '%English%' AND objectives IS NOT NULL;

-- Update Science homework with specific content
UPDATE homework 
SET 
    objectives = JSON_ARRAY(
        'Understand scientific concepts',
        'Conduct simple experiments',
        'Observe and record findings'
    ),
    activities = JSON_ARRAY(
        'Read science chapter',
        'Complete experiment worksheet',
        'Record observations'
    ),
    materials = JSON_ARRAY(
        'Science textbook',
        'Experiment materials',
        'Observation notebook',
        'Safety goggles'
    ),
    parent_guidance = 'Supervise experiments and discuss what your child observes. Ask them to explain what they learned.',
    difficulty = 'hard',
    duration = 40
WHERE subject LIKE '%Science%' AND objectives IS NOT NULL;
