import express from 'express';
import { markAttendance } from '../controllers/attendance.conrtroller.js';

const router = express.Router();

router.post('/mark-attendance', markAttendance);

export default router;