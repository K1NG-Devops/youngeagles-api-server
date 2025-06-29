-- Seed children and homework data for Martin Baker (user ID 25)
-- First, let's add some children for Martin Baker

INSERT INTO children (name, grade, parent_id, date_of_birth, enrollment_date, age, first_name, last_name, dob) VALUES
('Emma Baker', 'RR', 25, '2019-04-12', '2023-01-15', 5, 'Emma', 'Baker', '2019-04-12'),
('Liam Baker', 'R', 25, '2018-08-07', '2021-01-15', 6, 'Liam', 'Baker', '2018-08-07');

-- Let's add some teachers first if they don't exist
INSERT IGNORE INTO staff (name, email, password, role, created_at) VALUES
('Ms. Sarah Johnson', 'sarah.johnson@youngeagles.org.za', '$2b$10$dummy.hash.for.teacher', 'teacher', NOW()),
('Mr. David Smith', 'david.smith@youngeagles.org.za', '$2b$10$dummy.hash.for.teacher', 'teacher', NOW());

-- Add homework assignments (using only columns that exist in the homework table)
-- For Emma Baker (Grade 3)
-- Adjusted to match available classes and grades
INSERT INTO homework (title, description, due_date, teacher_id, grade, status, points) 
SELECT 
    'Simple Art Project',
    'Create a collage using household items.',
    DATE_ADD(NOW(), INTERVAL 4 DAY),
    s.id,
    'RR',
    'active',
    10
FROM staff s WHERE s.email = 'sarah.johnson@youngeagles.org.za' LIMIT 1;

INSERT INTO homework (title, description, due_date, teacher_id, grade, status, points) 
SELECT 
    'Storytime Reading',
    'Read a short story of your choice and discuss with your parent.',
    DATE_ADD(NOW(), INTERVAL 5 DAY),
    s.id,
    'R',
    'active',
    15
FROM staff s WHERE s.email = 'david.smith@youngeagles.org.za' LIMIT 1;

-- For Liam Baker (Grade R)
INSERT INTO homework (title, description, due_date, teacher_id, grade, status, points) 
SELECT 
    'Multiplication Tables Practice',
    'Practice multiplication tables 6-9. Complete the online quiz and print your results.',
    DATE_ADD(NOW(), INTERVAL 2 DAY),
    s.id,
    'Grade 5',
    'active',
    25
FROM staff s WHERE s.email = 'sarah.johnson@youngeagles.org.za' LIMIT 1;

INSERT INTO homework (title, description, due_date, teacher_id, grade, status, points) 
SELECT 
    'Creative Writing - My Adventure',
    'Write a 200-word story about an adventure you would like to have. Use descriptive words.',
    DATE_ADD(NOW(), INTERVAL 7 DAY),
    s.id,
    'Grade 5',
    'active',
    30
FROM staff s WHERE s.email = 'david.smith@youngeagles.org.za' LIMIT 1;

-- Add some notifications for Martin Baker
INSERT INTO notifications (userId, userType, title, body, type, isRead, createdAt, updatedAt) VALUES
(25, 'parent', 'New Homework Assigned', 'Emma has new math homework due in 3 days', 'homework', 0, NOW(), NOW()),
(25, 'parent', 'Homework Submitted', 'Liam submitted his creative writing assignment', 'homework', 0, DATE_SUB(NOW(), INTERVAL 30 MINUTE), DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(25, 'parent', 'Grade Posted', 'Emma received a grade for her math worksheet: 18/20', 'homework', 0, DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 2 HOUR));

-- Show what we've created
SELECT 'Children for Martin Baker:' as info;
SELECT id, name, grade, date_of_birth FROM children WHERE parent_id = 25;

SELECT 'Homework assignments:' as info;
SELECT h.id, h.title, h.grade, h.due_date, h.status, h.points
FROM homework h 
WHERE h.grade IN ('Grade 3', 'Grade 5') 
ORDER BY h.created_at DESC;

SELECT 'Recent notifications for Martin:' as info;
SELECT title, body, type, createdAt FROM notifications WHERE userId = 25 ORDER BY createdAt DESC;
