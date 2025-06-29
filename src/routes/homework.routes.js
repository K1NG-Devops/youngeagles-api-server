import { Router } from 'express';
import upload from '../middleware/uploadMiddleware.js';
import { query, execute } from '../db.js';
import {
  assignHomework,
  getHomeworkForParent,
  submitHomework,
  deleteSubmissions,  
  getSubmission,
  getHomeworksForTeacher,
  deleteHomework,
  updateHomework,
  getSubmissionsForHomework,
  getAllSubmissionsForTeacher,
  createAdvancedHomework,
  getAdvancedHomeworkDetails,
  updateSkillProgress,
  getStudentSkillProgress,
  generateWeeklyReport
} from '../controllers/homeworkController.js';
import { sendPushNotification } from '../utils/pushNotifications.js';

import {authMiddleware, isTeacher} from '../middleware/authMiddleware.js';

// Function to send homework notification to parents
const sendHomeworkNotification = async (className, homeworkTitle, teacherName, homeworkId) => {
  try {
    console.log('📢 Sending homework notification:', {
      className,
      homeworkTitle,
      teacherName,
      homeworkId
    });
    
    // Get all parents with children in this class
    const parents = await query(
      `SELECT DISTINCT c.parent_id, u.name as parent_name 
       FROM children c 
       LEFT JOIN users u ON c.parent_id = u.id 
       WHERE c.className = ?`,
      [className],
      'skydek_DB'
    );
    
    console.log(`Found ${parents.length} parents in class ${className}`);
    
    if (parents.length === 0) {
      console.log('No parents found for this class');
      return;
    }
    
    // Get FCM tokens for these parents
    const parentIds = parents.map(p => p.parent_id).filter(id => id !== null);
    if (parentIds.length === 0) {
      console.log('No valid parent IDs found');
      return;
    }
    
    const tokens = await query(
      `SELECT user_id, token FROM fcm_tokens 
       WHERE user_id IN (${parentIds.map(() => '?').join(',')}) AND is_active = TRUE`,
      parentIds,
      'skydek_DB'
    );
    
    console.log(`Found ${tokens.length} active FCM tokens`);
    
    // Prepare notification payload
    const notification = {
      title: 'New Homework Posted! 📚',
      body: `Teacher ${teacherName} posted "${homeworkTitle}" for your child's class.`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-96x96.png',
      tag: `homework-${homeworkId}`,
      data: {
        type: 'homework',
        homeworkId: homeworkId.toString(),
        teacherName,
        className,
        url: '/homework'
      }
    };
    
    // Send push notification using the new system (temporarily disabled)
    const tokenList = tokens.map(t => t.token);
    
    // const pushResult = await sendPushNotification(
    //   tokenList,
    //   notification,
    //   notification.data
    // );
    
    console.log(`📱 Would send push notification to ${tokenList.length} devices (temporarily disabled)`);
    
    // Store notification in database for all parents in the class
    console.log(`📝 Creating notifications for ${parents.length} parents in ${className} class`);
    
    for (const parent of parents) {
      if (!parent.parent_id) {
        console.log('Skipping parent with null ID');
        continue;
      }
      
      try {
                 await execute(
           `INSERT INTO notifications (userId, userType, title, body, type, isRead, createdAt, updatedAt) 
            VALUES (?, 'parent', ?, ?, 'homework', FALSE, NOW(), NOW())`,
           [
             parent.parent_id,
             notification.title,
             notification.body
           ],
           'skydek_DB'
         );
        console.log(`✅ Notification created for parent ${parent.parent_id} (${parent.parent_name})`);
      } catch (error) {
        console.error(`❌ Failed to create notification for parent ${parent.parent_id}:`, error);
      }
    }
    
    console.log('✅ Homework notification process completed');
    
  } catch (error) {
    console.error('❌ Error sending homework notification:', error);
    // Don't throw error to prevent homework upload from failing
  }
};

const router = Router();

// Teacher submission viewing routes - MUST BE DEFINED FIRST
router.get('/teacher/submissions', [authMiddleware, isTeacher], async (req, res) => {
  try {
    const teacherId = req.user.id;
    
    // Get submissions for homework assigned by this teacher
    const submissions = await query(
      'SELECT s.*, h.title as homework_title, u.name as parent_name FROM submissions s LEFT JOIN homeworks h ON s.homework_id = h.id LEFT JOIN users u ON s.parent_id = u.id WHERE h.uploaded_by_teacher_id = ? ORDER BY s.submitted_at DESC',
      [teacherId],
      'skydek_DB'
    );
    
    res.json({
      success: true,
      submissions: submissions || [],
      count: submissions ? submissions.length : 0
    });
  } catch (error) {
    console.error('Error fetching homework submissions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching submissions',
      error: error.message 
    });
  }
});

router.get('/teacher/all-submissions', authMiddleware, getAllSubmissionsForTeacher);

// Other routes
router.post('/assign', authMiddleware, upload.single('file'), assignHomework);

// Create homework endpoint (without file requirement)
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { title, description, class_name, due_date, child_ids } = req.body;
    const teacherId = req.user.id;
    
    console.log('📝 Creating homework:', { title, class_name, due_date, child_ids });
    
    // Validate required fields
    if (!title || !due_date || !class_name) {
      return res.status(400).json({
        success: false,
        message: 'Title, due date, and class name are required',
        error: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    // Get teacher's class to validate
    const teacherData = await query(
      'SELECT className, name FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );
    
    if (teacherData.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Teacher not found or not authorized',
        error: 'TEACHER_NOT_FOUND'
      });
    }
    
    const teacherClass = teacherData[0].className;
    const teacherName = teacherData[0].name || 'Your teacher';
    
    // Validate teacher can assign to this class
    if (teacherClass && teacherClass !== class_name) {
      return res.status(403).json({
        success: false,
        message: `You can only create homework for your assigned class: ${teacherClass}`,
        error: 'CLASS_NOT_ASSIGNED'
      });
    }
    
    // Format due date
    const formattedDueDate = new Date(due_date).toISOString().split('T')[0];
    
    // Insert homework into database
    const result = await execute(
      `INSERT INTO homeworks (
        title, 
        instructions, 
        due_date, 
        class_name, 
        uploaded_by_teacher_id, 
        grade, 
        status, 
        created_at
      ) VALUES (?, ?, ?, ?, ?, 'R', 'Pending', NOW())`,
      [
        title,
        description || '',
        formattedDueDate,
        class_name,
        teacherId
      ],
      'skydek_DB'
    );
    
    const homeworkId = result.insertId;
    
    console.log('✅ Homework created successfully:', {
      homeworkId,
      title,
      class_name
    });
    
    // Send notification to parents in this class
    try {
      await sendHomeworkNotification(class_name, title, teacherName, homeworkId);
      console.log('✅ Homework notification sent successfully');
    } catch (notificationError) {
      console.error('❌ Failed to send homework notification:', notificationError);
      // Don't fail the homework creation if notification fails
    }
    
    res.status(201).json({
      success: true,
      message: 'Homework created successfully',
      homeworkId: homeworkId,
      homework: {
        id: homeworkId,
        title,
        instructions: description || '',
        due_date: formattedDueDate,
        class_name,
        status: 'Pending',
        uploaded_by_teacher_id: teacherId
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating homework:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create homework',
      error: 'DATABASE_ERROR',
      details: error.message
    });
  }
});
router.get('/', authMiddleware, getHomeworkForParent);
router.post('/submit', authMiddleware, submitHomework);

// Route for submitting homework with homeworkId parameter (PWA compatibility)
router.post('/submit/:homeworkId', authMiddleware, upload.array('files', 5), async (req, res) => {
  console.log('📝 Submit homework with homeworkId parameter:', req.params.homeworkId);
  console.log('📝 Request body before mapping:', req.body);
  console.log('📝 Files received:', req.files ? req.files.length : 0);
  
  // Extract homeworkId from URL parameter and add it to the request body
  req.body.homeworkId = req.params.homeworkId;
  
  // Handle field name variations (parent_id vs parentId, child_id vs childId)
  if (req.body.parent_id && !req.body.parentId) {
    req.body.parentId = req.body.parent_id;
  }
  if (req.body.child_id && !req.body.childId) {
    req.body.childId = req.body.child_id;
  }
  
  console.log('📝 Request body after mapping:', {
    homeworkId: req.body.homeworkId,
    parentId: req.body.parentId,
    childId: req.body.childId,
    comment: req.body.comment
  });
  
  console.log('📝 Processed request body:', {
    homeworkId: req.body.homeworkId,
    parentId: req.body.parentId,
    childId: req.body.childId,
    hasFiles: !!(req.files && req.files.length > 0)
  });
  
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
        
        // Create notification for parent only (preschool children don't need notifications)
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
router.get('/for-parent/:parent_id', authMiddleware, getHomeworkForParent);  
router.delete('/submissions/:submissionId', authMiddleware, deleteSubmissions);
router.get('/submissions/:homeworkId/:parentId', getSubmission);
router.get('/for-teacher/:teacherId', authMiddleware, getHomeworksForTeacher);
router.delete('/:homeworkId', authMiddleware, deleteHomework);
router.put('/:homeworkId', authMiddleware, updateHomework);
router.get('/:homeworkId/submissions', authMiddleware, getSubmissionsForHomework);

// Teacher-specific stats route
router.get('/teacher/stats', [authMiddleware, isTeacher], async (req, res) => {
  const teacherId = req.user.id;
  try {
    // Get total homeworks created by teacher
    const [homeworksResult] = await query(
      `SELECT COUNT(*) as totalHomeworks FROM homeworks WHERE uploaded_by_teacher_id = ?`,
      [teacherId]
    );

    // Get total submissions for those homeworks
    const [submissionsResult] = await query(
      `SELECT COUNT(*) as totalSubmissions,
              SUM(CASE WHEN status = 'Graded' THEN 1 ELSE 0 END) as gradedSubmissions,
              SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pendingSubmissions
       FROM submissions s
       JOIN homeworks h ON s.homework_id = h.id
       WHERE h.uploaded_by_teacher_id = ?`,
      [teacherId]
    );

    const stats = {
      totalHomeworks: homeworksResult.totalHomeworks || 0,
      totalSubmissions: submissionsResult.totalSubmissions || 0,
      gradedSubmissions: submissionsResult.gradedSubmissions || 0,
      pendingSubmissions: submissionsResult.pendingSubmissions || 0,
    };

    res.json({ success: true, stats });

  } catch (error) {
    console.error(`Error fetching teacher stats for teacher ${teacherId}:`, error);
    res.status(500).json({ success: false, message: "Failed to fetch teacher statistics." });
  }
});

// **NEW ADVANCED HOMEWORK ROUTES**
// Advanced homework creation with skills tracking
router.post('/advanced/create', authMiddleware, upload.fields([
  { name: 'audioInstructions', maxCount: 1 },
  { name: 'visualAids', maxCount: 10 }
]), createAdvancedHomework);

// Get detailed homework with skills and assessment data
router.get('/advanced/:homeworkId', authMiddleware, getAdvancedHomeworkDetails);

// Skill progress tracking
router.post('/skills/progress', authMiddleware, updateSkillProgress);
router.get('/skills/progress/:studentId', authMiddleware, getStudentSkillProgress);

// Weekly report generation
router.get('/reports/weekly/:studentId', authMiddleware, generateWeeklyReport);
router.post('/reports/weekly/generate', authMiddleware, generateWeeklyReport);

// Get saved weekly report by ID (temporarily disabled - function not implemented)
// router.get('/reports/saved/:id', authMiddleware, getSavedWeeklyReport);

router.get('/submissions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let submissions;
    
    if (userRole === 'parent') {
      // Get submissions for this parent
      submissions = await query(
        'SELECT s.*, h.title as homework_title FROM submissions s LEFT JOIN homeworks h ON s.homework_id = h.id WHERE s.parent_id = ? ORDER BY s.submitted_at DESC',
        [userId],
        'skydek_DB'
      );
    } else if (userRole === 'teacher') {
      // Get submissions for homework assigned by this teacher
      submissions = await query(
        'SELECT s.*, h.title as homework_title, u.name as parent_name FROM submissions s LEFT JOIN homeworks h ON s.homework_id = h.id LEFT JOIN users u ON s.parent_id = u.id WHERE h.uploaded_by_teacher_id = ? ORDER BY s.submitted_at DESC',
        [userId],
        'skydek_DB'
      );
    } else {
      // Admin can see all submissions
      submissions = await query(
        'SELECT s.*, h.title as homework_title, u.name as parent_name FROM submissions s LEFT JOIN homeworks h ON s.homework_id = h.id LEFT JOIN users u ON s.parent_id = u.id ORDER BY s.submitted_at DESC',
        [],
        'skydek_DB'
      );
    }
    
    res.json({
      success: true,
      submissions: submissions || [],
      count: submissions ? submissions.length : 0
    });
  } catch (error) {
    console.error('Error fetching homework submissions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching submissions',
      error: error.message 
    });
  }
});

router.delete('/submissions/:id', authMiddleware, deleteSubmissions);

// Get homework for parent/child (PWA compatibility route)
router.get('/parent/:parentId/child/:childId', authMiddleware, async (req, res) => {
  try {
    const { parentId, childId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Check if parent has access to this child
    if (userRole === 'parent') {
      const childCheck = await query(
        'SELECT id FROM children WHERE id = ? AND parent_id = ?',
        [childId, userId],
        'skydek_DB'
      );
      
      if (childCheck.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Child not found or does not belong to this parent'
        });
      }
    }
    
    // Get homework for this child
    const homework = await query(
      `SELECT 
        h.id,
        h.title,
        h.instructions as description,
        h.due_date,
        h.created_at,
        s.status,
        s.grade,
        s.feedback,
        s.submitted_at,
        s.comment,
        CASE 
          WHEN s.id IS NOT NULL THEN 'submitted'
          WHEN h.due_date < NOW() THEN 'overdue'
          ELSE 'pending'
        END as homework_status
      FROM homeworks h
      LEFT JOIN submissions s ON h.id = s.homework_id AND s.child_id = ?
      WHERE h.class_name IN (
        SELECT DISTINCT className FROM children WHERE id = ?
      )
      ORDER BY h.created_at DESC
      LIMIT 20`,
      [childId, childId],
      'skydek_DB'
    );
    
    // Calculate stats
    const totalHomework = homework.length;
    const submittedHomework = homework.filter(h => h.status === 'submitted' || h.homework_status === 'submitted').length;
    const overdueHomework = homework.filter(h => h.homework_status === 'overdue').length;
    const pendingHomework = homework.filter(h => h.homework_status === 'pending').length;
    
    res.json({
      success: true,
      homework: homework || [],
      stats: {
        total: totalHomework,
        submitted: submittedHomework,
        pending: pendingHomework,
        overdue: overdueHomework,
        completion_rate: totalHomework > 0 ? Math.round((submittedHomework / totalHomework) * 100) : 0
      },
      parentId: parentId,
      childId: childId,
      count: homework ? homework.length : 0
    });
    
  } catch (error) {
    console.error('Error fetching homework for parent/child:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching homework',
      error: error.message
    });
  }
});

// Get grades for a specific child
router.get('/grades/child/:childId', authMiddleware, async (req, res) => {
  try {
    const { childId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Check if parent has access to this child
    if (userRole === 'parent') {
      const childCheck = await query(
        'SELECT id FROM children WHERE id = ? AND parent_id = ?',
        [childId, userId],
        'skydek_DB'
      );
      
      if (childCheck.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Child not found or does not belong to this parent'
        });
      }
    }
    
    // Get homework grades/submissions for this child
    const grades = await query(
      `SELECT 
        h.id as homework_id,
        h.title,
        h.instructions as description,
        h.due_date,
        h.created_at,
        s.status,
        s.grade,
        s.feedback,
        s.submitted_at,
        s.graded_at,
        s.comment
      FROM homeworks h
      LEFT JOIN submissions s ON h.id = s.homework_id AND s.child_id = ?
      WHERE h.class_name IN (
        SELECT DISTINCT className FROM children WHERE id = ?
      ) OR s.child_id = ?
      ORDER BY h.created_at DESC
      LIMIT 20`,
      [childId, childId, childId],
      'skydek_DB'
    );
    
    res.json({
      success: true,
      grades: grades || [],
      childId: childId,
      count: grades ? grades.length : 0
    });
    
  } catch (error) {
    console.error('Error fetching child grades:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching grades',
      error: error.message
    });
  }
});

export default router;
