# Fix for Daniel Baker Homework Submission Notifications and Submit Work Endpoint

## Issues Identified

### 1. Daniel Baker's Homework Submission Missing homework_id
**Problem**: Daniel Baker's homework submission (id: 1) in the database has `homework_id: null`, which breaks the notification system that relies on this relationship.

**Root Cause**: The submission was created without properly linking it to a homework assignment.

### 2. Submit Work Endpoint 404 Error  
**Problem**: The PWA was calling `/api/homework/submit/:homeworkId` but the endpoint wasn't properly configured to handle the homeworkId parameter.

**Root Cause**: The route was defined as `/submit` instead of `/submit/:homeworkId`, and the controller wasn't extracting the homeworkId from URL parameters.

## Fixes Applied

### 1. Added Missing Route for Submit Work Endpoint

**File**: `/src/routes/homework.routes.js`

Added the following route to handle homeworkId parameter:

```javascript
// Route for submitting homework with homeworkId parameter (PWA compatibility)
router.post('/submit/:homeworkId', authMiddleware, async (req, res) => {
  console.log('📝 Submit homework with homeworkId parameter:', req.params.homeworkId);
  
  // Extract homeworkId from URL parameter and add it to the request body
  req.body.homeworkId = req.params.homeworkId;
  
  try {
    // Call the existing submitHomework function
    await submitHomework(req, res);
    
    // If submission was successful, create notifications
    if (res.statusCode === 201) {
      const { homeworkId } = req.params;
      const { parentId, childId } = req.body;
      
      // Get homework and child information for notification
      const homework = await query(
        'SELECT title, class_name FROM homeworks WHERE id = ?',
        [homeworkId],
        'skydek_DB'
      );
      
      const child = await query(
        'SELECT name FROM children WHERE id = ?',
        [childId],
        'skydek_DB'
      );
      
      if (homework && homework.length > 0 && child && child.length > 0) {
        const homeworkTitle = homework[0].title;
        const childName = child[0].name;
        
        // Create notification for parent
        await execute(
          `INSERT INTO notifications (userId, userType, title, body, type, createdAt, updatedAt) 
           VALUES (?, 'parent', ?, ?, 'homework', NOW(), NOW())`,
          [
            parentId,
            'Homework Submitted Successfully',
            `${childName} has successfully submitted homework: "${homeworkTitle}"`
          ],
          'skydek_DB'
        );
        
        // Create notification for student
        await execute(
          `INSERT INTO notifications (userId, userType, title, body, type, createdAt, updatedAt) 
           VALUES (?, 'student', ?, ?, 'homework', NOW(), NOW())`,
          [
            childId,
            'Homework Submitted',
            `Your homework "${homeworkTitle}" has been submitted successfully`
          ],
          'skydek_DB'
        );
        
        console.log('✅ Homework submission notifications created');
      }
    }
  } catch (error) {
    console.error('❌ Error in homework submission with parameter:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Internal server error during submission',
        error: error.message 
      });
    }
  }
});
```

### 2. Database Fix Script

**Files**: 
- `/database_fixes.sql` (simple version)
- `/COMPLETE_DATABASE_FIX.sql` (comprehensive version with verification)

**RECOMMENDED**: Use the complete version for better verification and error handling.

#### Quick Fix (database_fixes.sql)
```sql
-- Fix Daniel Baker's homework submission linking
-- Link to homework ID 15 (Math Practice for Panda class)
UPDATE homework_submissions 
SET homework_id = 15
WHERE studentId = 15 AND studentName = 'Daniel Baker' AND homework_id IS NULL;

-- Create notifications (assuming notifications table exists)
INSERT INTO notifications (userId, userType, title, body, type, `read`, createdAt, updatedAt)
VALUES 
(15, 'student', 'Homework Submitted Successfully', 'Your homework "Math Practice" has been submitted successfully', 'homework', FALSE, NOW(), NOW()),
(25, 'parent', 'Homework Submitted by Daniel Baker', 'Daniel Baker has submitted homework: "Math Practice"', 'homework', FALSE, NOW(), NOW());
```

#### Complete Fix (COMPLETE_DATABASE_FIX.sql)
This script includes:
- Table structure verification and creation
- Detailed analysis of current state
- Safe updates with duplicate prevention
- Comprehensive verification queries

**Key Points**:
- Daniel Baker (studentId: 15) is in Panda class (class_id: 1)
- His parent_id is 25 (from children table)
- Homework ID 15 "Math Practice" is appropriate for his class
- The script creates notifications table if it doesn't exist
- Prevents duplicate notifications

## Testing Instructions

### 1. Test Submit Work Endpoint

```bash
# Test that the endpoint now exists (should get auth error, not 404)
curl -X POST "http://localhost:3001/api/homework/submit/15" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Expected response: {"message":"No token provided.","shouldRedirect":true}
# (Not a 404 error anymore)
```

### 2. Test with Valid Authentication

The PWA should now be able to submit homework using the format:
`POST /api/homework/submit/:homeworkId`

### 3. Verify Notifications

After running the database fix script, check:

1. **Daniel Baker's submission is linked**: 
   - `homework_submissions.homework_id` should no longer be null
   
2. **Notifications are created**: 
   - Check the `notifications` table for entries related to Daniel Baker's submission
   
3. **PWA notifications page**: 
   - The notifications should now appear in the PWA notifications page

## Verification Queries

```sql
-- Check Daniel Baker's updated submission
SELECT 
  hs.id,
  hs.studentName,
  hs.homework_id,
  h.title as homework_title,
  hs.status,
  hs.date as submission_date
FROM homework_submissions hs
LEFT JOIN homeworks h ON hs.homework_id = h.id
WHERE hs.studentId = 15;

-- Check notifications created
SELECT * FROM notifications 
WHERE (userId = 15 AND userType = 'student') 
   OR (userId = (SELECT parent_id FROM children WHERE id = 15) AND userType = 'parent')
ORDER BY createdAt DESC;

-- Verify notification counter
SELECT COUNT(*) as notification_count 
FROM notifications 
WHERE userId = (SELECT parent_id FROM children WHERE id = 15) 
  AND userType = 'parent';
```

## Summary of Changes

1. ✅ **Fixed Submit Work endpoint** - Added `/submit/:homeworkId` route with proper parameter handling
2. ✅ **Enhanced notification system** - Automatic notification creation on homework submission
3. ✅ **Database linking fix** - SQL script to link Daniel Baker's submission to homework
4. ✅ **PWA compatibility** - Endpoint now works with the PWA's expected URL format

The Submit Work endpoint should no longer return 404 errors, and once the database fix is applied, Daniel Baker's homework submission notifications should appear properly in the notifications page and counter.
