-- Seed children and homework data for Martin Baker (user ID 25)
-- First, let's add some children for Martin Baker

INSERT INTO children (name, grade, parent_id, date_of_birth, enrollment_date, age, first_name, last_name, dob) VALUES
('Emma Baker', 'Grade 3', 25, '2015-04-12', '2023-01-15', 9, 'Emma', 'Baker', '2015-04-12'),
('Liam Baker', 'Grade 5', 25, '2013-08-07', '2021-01-15', 11, 'Liam', 'Baker', '2013-08-07');

-- Get the child IDs (we'll use variables but for safety, let's assume they'll be auto-incremented)
-- We need to find the actual IDs after insertion for homework

-- Let's add some teachers first if they don't exist
INSERT IGNORE INTO staff (name, email, password, role, created_at) VALUES
('Ms. Sarah Johnson', 'sarah.johnson@youngeagles.org.za', '$2b$10$dummy.hash.for.teacher', 'teacher', NOW()),
('Mr. David Smith', 'david.smith@youngeagles.org.za', '$2b$10$dummy.hash.for.teacher', 'teacher', NOW());

-- Add homework assignments (we'll need to get child IDs dynamically)
-- For Emma Baker (Grade 3)
INSERT INTO homework (title, description, subject, due_date, assigned_date, teacher_id, grade_level, status, points) 
SELECT 
    'Math Worksheet - Addition and Subtraction',
    'Complete pages 15-18 in your math workbook. Show all your work clearly.',
    'Mathematics',
    DATE_ADD(NOW(), INTERVAL 3 DAY),
    NOW(),
    s.id,
    'Grade 3',
    'assigned',
    20
FROM staff s WHERE s.email = 'sarah.johnson@youngeagles.org.za' LIMIT 1;

INSERT INTO homework (title, description, subject, due_date, assigned_date, teacher_id, grade_level, status, points) 
SELECT 
    'Reading Comprehension - The Magic Tree',
    'Read chapter 2 of "The Magic Tree" and answer the questions on page 25.',
    'English',
    DATE_ADD(NOW(), INTERVAL 5 DAY),
    DATE_SUB(NOW(), INTERVAL 1 DAY),
    s.id,
    'Grade 3',
    'assigned',
    15
FROM staff s WHERE s.email = 'david.smith@youngeagles.org.za' LIMIT 1;

-- For Liam Baker (Grade 5)
INSERT INTO homework (title, description, subject, due_date, assigned_date, teacher_id, grade_level, status, points) 
SELECT 
    'Multiplication Tables Practice',
    'Practice multiplication tables 6-9. Complete the online quiz and print your results.',
    'Mathematics',
    DATE_ADD(NOW(), INTERVAL 2 DAY),
    DATE_SUB(NOW(), INTERVAL 1 DAY),
    s.id,
    'Grade 5',
    'assigned',
    25
FROM staff s WHERE s.email = 'sarah.johnson@youngeagles.org.za' LIMIT 1;

INSERT INTO homework (title, description, subject, due_date, assigned_date, teacher_id, grade_level, status, points) 
SELECT 
    'Creative Writing - My Adventure',
    'Write a 200-word story about an adventure you would like to have. Use descriptive words.',
    'English',
    DATE_ADD(NOW(), INTERVAL 7 DAY),
    NOW(),
    s.id,
    'Grade 5',
    'assigned',
    30
FROM staff s WHERE s.email = 'david.smith@youngeagles.org.za' LIMIT 1;

-- Add some homework submissions for variety
-- We'll need to link submissions to the actual homework and children
INSERT INTO homework_submissions (homework_id, child_id, submission_text, submission_date, status, grade, feedback)
SELECT 
    h.id,
    c.id,
    'I completed the math worksheet. Here are my answers: 1) 15+7=22, 2) 23-8=15, 3) 45+12=57...',
    DATE_SUB(NOW(), INTERVAL 2 HOUR),
    'submitted',
    18,
    'Good work! Check your addition on problem 3.'
FROM homework h
JOIN children c ON c.parent_id = 25 AND c.name = 'Emma Baker'
WHERE h.title = 'Math Worksheet - Addition and Subtraction'
LIMIT 1;

INSERT INTO homework_submissions (homework_id, child_id, submission_text, submission_date, status, grade, feedback)
SELECT 
    h.id,
    c.id,
    'My Adventure Story: I would love to go on a safari in Africa where I could see elephants, lions, and giraffes...',
    DATE_SUB(NOW(), INTERVAL 30 MINUTE),
    'submitted',
    NULL,
    NULL
FROM homework h
JOIN children c ON c.parent_id = 25 AND c.name = 'Liam Baker'
WHERE h.title = 'Creative Writing - My Adventure'
LIMIT 1;

-- Add some notifications for Martin Baker
INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES
(25, 'New Homework Assigned', 'Emma has new math homework due in 3 days', 'homework', false, NOW()),
(25, 'Homework Submitted', 'Liam submitted his creative writing assignment', 'submission', false, DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(25, 'Grade Posted', 'Emma received a grade for her math worksheet: 18/20', 'grade', false, DATE_SUB(NOW(), INTERVAL 2 HOUR));

-- Show what we've created
SELECT 'Children for Martin Baker:' as info;
SELECT id, name, grade, date_of_birth FROM children WHERE parent_id = 25;

SELECT 'Homework assignments:' as info;
SELECT h.id, h.title, h.subject, h.grade_level, h.due_date, h.status 
FROM homework h 
WHERE h.grade_level IN ('Grade 3', 'Grade 5') 
ORDER BY h.assigned_date DESC;

SELECT 'Recent notifications for Martin:' as info;
SELECT title, message, type, created_at FROM notifications WHERE user_id = 25 ORDER BY created_at DESC;
