import { Router } from 'express';
import upload from '../middleware/uploadMiddleware.js';
import {
  assignHomework,
  getHomeworkForParent,
  submitHomework,
  deleteSubmissions,  
} from '../controllers/homeworkController.js';

import {authMiddleware} from '../middleware/authMiddleware.js';

const router = Router();

router.post('/assign', authMiddleware, upload.single('file'), assignHomework);
router.get('/', authMiddleware, getHomeworkForParent);
router.post('/submit', authMiddleware, upload.single('submission'), submitHomework);
router.get('/for-parent/:parent_id', authMiddleware, getHomeworkForParent);  
router.delete('/submissions/:submissionId', authMiddleware, deleteSubmissions);


export default router;
