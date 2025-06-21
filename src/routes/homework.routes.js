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
} from '../controllers/homeworkController.js';

import {authMiddleware} from '../middleware/authMiddleware.js';

const router = Router();

router.post('/assign', authMiddleware, upload.single('file'), assignHomework);
router.get('/', authMiddleware, getHomeworkForParent);
router.post('/submit', authMiddleware, submitHomework);
router.get('/for-parent/:parent_id', authMiddleware, getHomeworkForParent);  
router.delete('/submissions/:submissionId', authMiddleware, deleteSubmissions);
router.get('/submissions/:homeworkId/:parentId', getSubmission);
router.get('/for-teacher/:teacherId', authMiddleware, getHomeworksForTeacher);
router.delete('/:homeworkId', authMiddleware, deleteHomework);
router.put('/:homeworkId', authMiddleware, updateHomework);

// Teacher submission viewing routes
router.get('/:homeworkId/submissions', authMiddleware, getSubmissionsForHomework);
router.get('/teacher/all-submissions', authMiddleware, getAllSubmissionsForTeacher);

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

export default router;
