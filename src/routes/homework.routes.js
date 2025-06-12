import { Router } from 'express';
import upload from '../middleware/uploadMiddleware.js';
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

export default router;
