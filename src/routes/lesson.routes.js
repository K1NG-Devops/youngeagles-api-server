import { authMiddleware } from '../middleware/authMiddleware.js';
import { getLessonsByAgeGroup } from '../controllers/getLessonByAgeGroup';

router.post('/upload', authMiddleware, upload.single('file'), uploadLesson);
router.get('/', authMiddleware, getLessonsByAgeGroup);