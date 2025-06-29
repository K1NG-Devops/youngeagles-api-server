-- COMPLETE DATABASE FIX FOR DANIEL BAKER HOMEWORK NOTIFICATIONS
-- This script fixes the homework submission linking and creates the missing notifications

-- =============================================================================
-- PART 1: VERIFY AND CREATE NOTIFICATIONS TABLE IF NEEDED
-- =============================================================================

-- Check if notifications table exists, create if it doesn't
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  userType ENUM('parent', 'student', 'teacher', 'admin') NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  type VARCHAR(50) DEFAULT 'general',
  `read` BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (userId, userType),
  INDEX idx_read (`read`),
  INDEX idx_created (createdAt)
);

-- =============================================================================
-- PART 2: ANALYSIS - WHAT'S CURRENTLY IN THE DATABASE
-- =============================================================================

-- Show Daniel Baker's current submission data
SELECT 'DANIEL BAKER SUBMISSION STATUS' as status;
SELECT 
  hs.id,
  hs.studentName,
  hs.homework_id,
  hs.status,
  hs.date as submission_date,
  hs.className
FROM homework_submissions hs
WHERE hs.studentId = 15;

-- Show available homework for Panda class (class_id = 1)
SELECT 'AVAILABLE HOMEWORK FOR PANDA CLASS' as status;
SELECT id, title, class_id, status, due_date FROM homeworks WHERE class_id = 1 ORDER BY id;

-- Show Daniel Baker's parent information
SELECT 'DANIEL BAKER PARENT INFO' as status;
SELECT id, name, parent_id, className FROM children WHERE id = 15;

-- =============================================================================
-- PART 3: FIX THE HOMEWORK SUBMISSION LINKING
-- =============================================================================

-- Update Daniel Baker's submission to link to homework ID 15 (Math Practice)
-- This is the most appropriate homework for his class based on the backup data
UPDATE homework_submissions 
SET homework_id = 15
WHERE studentId = 15 AND studentName = 'Daniel Baker' AND homework_id IS NULL;

-- Verify the update
SELECT 'VERIFICATION AFTER UPDATE' as status;
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

-- =============================================================================
-- PART 4: CREATE MISSING NOTIFICATIONS
-- =============================================================================

-- Create notification for Daniel Baker's parent only (preschool children don't need notifications)
-- Parent ID is 25 based on the children table data
INSERT INTO notifications (userId, userType, title, body, type, `read`, createdAt, updatedAt)
SELECT 
  c.parent_id as userId,
  'parent' as userType,
  'Homework Submitted by Daniel Baker' as title,
  CONCAT('Daniel Baker has submitted homework: "', COALESCE(h.title, 'Math Practice'), '"') as body,
  'homework' as type,
  FALSE as `read`,
  NOW() as createdAt,
  NOW() as updatedAt
FROM homework_submissions hs
LEFT JOIN homeworks h ON hs.homework_id = h.id
LEFT JOIN children c ON hs.studentId = c.id
WHERE hs.studentId = 15 AND hs.homework_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM notifications 
  WHERE userId = c.parent_id AND userType = 'parent' AND type = 'homework' 
  AND title = 'Homework Submitted by Daniel Baker'
)
LIMIT 1;

-- =============================================================================
-- PART 5: VERIFICATION QUERIES
-- =============================================================================

-- Show all notifications for Daniel Baker and his parent
SELECT 'NOTIFICATIONS FOR DANIEL BAKER (STUDENT)' as status;
SELECT * FROM notifications WHERE userId = 15 AND userType = 'student' ORDER BY createdAt DESC;

SELECT 'NOTIFICATIONS FOR DANIEL BAKER PARENT' as status;
SELECT n.* FROM notifications n
WHERE n.userId = (SELECT parent_id FROM children WHERE id = 15) 
AND n.userType = 'parent' 
ORDER BY n.createdAt DESC;

-- Count notifications for verification
SELECT 'NOTIFICATION COUNTS' as status;
SELECT 
  'Daniel Baker (Student)' as user_type,
  COUNT(*) as notification_count
FROM notifications 
WHERE userId = 15 AND userType = 'student'
UNION ALL
SELECT 
  'Daniel Baker Parent' as user_type,
  COUNT(*) as notification_count
FROM notifications 
WHERE userId = (SELECT parent_id FROM children WHERE id = 15) AND userType = 'parent';

-- Final verification - show the complete picture
SELECT 'FINAL VERIFICATION - COMPLETE PICTURE' as status;
SELECT 
  hs.id as submission_id,
  hs.studentName,
  hs.homework_id,
  h.title as homework_title,
  h.class_id,
  hs.status as submission_status,
  hs.date as submission_date,
  c.parent_id,
  (SELECT COUNT(*) FROM notifications WHERE userId = 15 AND userType = 'student') as student_notifications,
  (SELECT COUNT(*) FROM notifications WHERE userId = c.parent_id AND userType = 'parent') as parent_notifications
FROM homework_submissions hs
LEFT JOIN homeworks h ON hs.homework_id = h.id
LEFT JOIN children c ON hs.studentId = c.id
WHERE hs.studentId = 15;
