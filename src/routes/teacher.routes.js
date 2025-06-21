import { Router } from 'express';
import { query, execute } from '../db.js';
import { authMiddleware, isTeacher } from '../middleware/authMiddleware.js';

const router = Router();

// Get teacher's classes
router.get('/classes', authMiddleware, isTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;
    
    // Get teacher's assigned classes
    const classes = await query(
      'SELECT DISTINCT className FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher'],
      'railway'
    );
    
    if (!classes || classes.length === 0) {
      return res.json({
        success: true,
        classes: [],
        message: 'No classes assigned to this teacher'
      });
    }
    
    // Get students in each class
    const classNames = classes.map(c => c.className);
    const students = await query(
      `SELECT * FROM children WHERE className IN (${classNames.map(() => '?').join(',')})`,
      classNames,
      'skydek_DB'
    );
    
    res.json({
      success: true,
      classes: classes,
      students: students || [],
      studentCount: students ? students.length : 0
    });
  } catch (error) {
    console.error('Error fetching classes for teacher:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching classes',
      error: error.message 
    });
  }
});

// Get homework assigned by teacher
router.get('/homework', authMiddleware, isTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;
    
    const homework = await query(
      'SELECT * FROM homeworks WHERE uploaded_by_teacher_id = ? ORDER BY due_date DESC',
      [teacherId],
      'skydek_DB'
    );
    
    res.json({
      success: true,
      homework: homework || [],
      count: homework ? homework.length : 0
    });
  } catch (error) {
    console.error('Error fetching homework for teacher:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching homework',
      error: error.message 
    });
  }
});

// Get attendance for teacher's classes
router.get('/attendance', authMiddleware, isTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { date, className } = req.query;
    
    let attendanceQuery = `
      SELECT a.*, c.name as student_name, c.className 
      FROM attendance a
      JOIN children c ON a.student_id = c.id
      WHERE a.teacher_id = ?
    `;
    const params = [teacherId];
    
    if (date) {
      attendanceQuery += ' AND DATE(a.date) = ?';
      params.push(date);
    }
    
    if (className) {
      attendanceQuery += ' AND c.className = ?';
      params.push(className);
    }
    
    attendanceQuery += ' ORDER BY a.date DESC, c.name ASC';
    
    const attendance = await query(attendanceQuery, params, 'skydek_DB');
    
    res.json({
      success: true,
      attendance: attendance || [],
      count: attendance ? attendance.length : 0
    });
  } catch (error) {
    console.error('Error fetching attendance for teacher:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching attendance',
      error: error.message 
    });
  }
});

// Get teacher's students
router.get('/students', authMiddleware, isTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;
    
    // Get teacher's classes first
    const teacherClasses = await query(
      'SELECT DISTINCT className FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher'],
      'railway'
    );
    
    if (!teacherClasses || teacherClasses.length === 0) {
      return res.json({
        success: true,
        students: [],
        message: 'No classes assigned to this teacher'
      });
    }
    
    const classNames = teacherClasses.map(c => c.className);
    const students = await query(
      `SELECT c.*, u.name as parent_name, u.email as parent_email 
       FROM children c
       LEFT JOIN users u ON c.parent_id = u.id
       WHERE c.className IN (${classNames.map(() => '?').join(',')})
       ORDER BY c.className, c.name`,
      classNames,
      'skydek_DB'
    );
    
    res.json({
      success: true,
      students: students || [],
      classes: teacherClasses,
      count: students ? students.length : 0
    });
  } catch (error) {
    console.error('Error fetching students for teacher:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching students',
      error: error.message 
    });
  }
});

// Get teacher's profile
router.get('/profile', authMiddleware, isTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;
    
    const teacher = await query(
      'SELECT id, name, email, className, created_at FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher'],
      'railway'
    );
    
    if (!teacher || teacher.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found'
      });
    }
    
    res.json({
      success: true,
      profile: teacher[0]
    });
  } catch (error) {
    console.error('Error fetching teacher profile:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching profile',
      error: error.message 
    });
  }
});

// Get teacher's dashboard data
router.get('/dashboard', authMiddleware, isTeacher, async (req, res) => {
  try {
    const teacherId = req.user.id;
    
    // Get student count
    const teacherClasses = await query(
      'SELECT DISTINCT className FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher'],
      'railway'
    );
    
    let studentCount = 0;
    if (teacherClasses && teacherClasses.length > 0) {
      const classNames = teacherClasses.map(c => c.className);
      const students = await query(
        `SELECT COUNT(*) as count FROM children WHERE className IN (${classNames.map(() => '?').join(',')})`,
        classNames,
        'skydek_DB'
      );
      studentCount = students[0]?.count || 0;
    }
    
    // Get homework count
    const homeworkCount = await query(
      'SELECT COUNT(*) as count FROM homeworks WHERE uploaded_by_teacher_id = ?',
      [teacherId],
      'skydek_DB'
    );
    
    // Get pending submissions count
    const pendingSubmissions = await query(
      `SELECT COUNT(*) as count FROM homeworks h
       LEFT JOIN submissions s ON h.id = s.homework_id
       WHERE h.uploaded_by_teacher_id = ? AND s.id IS NULL AND h.due_date >= CURDATE()`,
      [teacherId],
      'skydek_DB'
    );
    
    res.json({
      success: true,
      dashboard: {
        studentCount: studentCount,
        homeworkCount: homeworkCount[0]?.count || 0,
        pendingSubmissions: pendingSubmissions[0]?.count || 0,
        classes: teacherClasses || []
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data for teacher:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message 
    });
  }
});

export default router; 