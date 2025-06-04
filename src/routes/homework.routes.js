import { Router } from 'express';
import upload from '../middleware/uploadMiddleware.js';
import {
  assignHomework,
  getHomeworkForParent,
  submitHomework,
  deleteSubmissions,  
  getSubmission,
} from '../controllers/homeworkController.js';

import {authMiddleware} from '../middleware/authMiddleware.js';

const router = Router();

router.post('/assign', authMiddleware, upload.single('file'), assignHomework);
router.get('/', authMiddleware, getHomeworkForParent);
router.post('/submit', submitHomework);
router.get('/for-parent/:parent_id', authMiddleware, getHomeworkForParent);  
router.delete('/submissions/:submissionId', authMiddleware, deleteSubmissions);
router.get('/submissions/:homeworkId/:parentId', getSubmission);

export default router;
