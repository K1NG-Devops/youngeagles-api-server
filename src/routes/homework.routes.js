import { Router } from 'express';
import upload from '../middleware/uploadMiddleware.js';
import {
  assignHomework,
  getHomeworkForParent,
  submitHomework
} from '../controllers/homeworkController.js';

import {authMiddleware} from '../middleware/authMiddleware.js';

const router = Router();

router.post('/assign', authMiddleware, upload.single('file'), assignHomework);
router.get('/', authMiddleware, getHomeworkForParent);
router.post('/submit', authMiddleware, upload.single('submission'), submitHomework);

export default router;
