import { Router } from 'express';
import upload from '../middleware/uploadMiddleware.js';
import { query } from '../db.js';
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

import {authMiddleware, isTeacher} from '../middleware/authMiddleware.js';

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
router.get('/', authMiddleware, getHomeworkForParent);
router.post('/submit', authMiddleware, submitHomework);
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
        h.description,
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
      FROM homework h
      LEFT JOIN submissions s ON h.id = s.homework_id AND s.child_id = ?
      WHERE h.class_id IN (
        SELECT DISTINCT class_id FROM children WHERE id = ?
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
        h.description,
        h.due_date,
        h.created_at,
        s.status,
        s.grade,
        s.feedback,
        s.submitted_at,
        s.graded_at,
        s.comment
      FROM homework h
      LEFT JOIN submissions s ON h.id = s.homework_id AND s.child_id = ?
      WHERE h.class_id IN (
        SELECT DISTINCT class_id FROM children WHERE id = ?
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
