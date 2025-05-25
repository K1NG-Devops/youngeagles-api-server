import express from 'express';
import { markAttendance, getAttendanceByTeacher } from '../controllers/attendance.controller.js';

const router = express.Router();

router.post('/mark-attendance', markAttendance);
router.get('/attendance/:teacherId', getAttendanceByTeacher);


export default router;