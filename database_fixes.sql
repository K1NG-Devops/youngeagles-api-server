-- Fix Daniel Baker's homework submission linking issue
-- Daniel Baker (studentId: 15) is in the "Panda" class which corresponds to class_id = 1

-- First, let's see what homework is available for Daniel Baker's class (Panda = class_id 1)
SELECT id, title, class_id, status FROM homeworks WHERE class_id = 1 ORDER BY id;

-- Update Daniel Baker's submission to link to homework ID 15 (Math Practice for Panda class)
-- Based on the backup data, homework ID 15 is "Math Practice" for class_id = 1 (Panda class)
UPDATE homework_submissions 
SET homework_id = 15
WHERE studentId = 15 AND studentName = 'Daniel Baker' AND homework_id IS NULL;

-- Verify the update was successful
SELECT 
  hs.id,
  hs.studentName,
  hs.homework_id,
  h.title as homework_title,
  h.class_id,
  hs.status,
  hs.date as submission_date
FROM homework_submissions hs
LEFT JOIN homeworks h ON hs.homework_id = h.id
WHERE hs.studentId = 15;

-- Create notification for Daniel Baker's parent only (preschool children don't need notifications)
-- Parent ID is 25 based on the children table data
INSERT INTO notifications (userId, userType, title, body, type, read, createdAt, updatedAt)
SELECT 
  c.parent_id as userId,
  'parent' as userType,
  'Homework Submitted by Daniel Baker' as title,
  CONCAT('Daniel Baker has submitted homework: "', h.title, '"') as body,
  'homework' as type,
  FALSE as read,
  NOW() as createdAt,
  NOW() as updatedAt
FROM homework_submissions hs
LEFT JOIN homeworks h ON hs.homework_id = h.id
LEFT JOIN children c ON hs.studentId = c.id
WHERE hs.studentId = 15 AND hs.homework_id IS NOT NULL
LIMIT 1;
