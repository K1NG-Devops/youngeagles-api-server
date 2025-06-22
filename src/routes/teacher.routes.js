import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { query } from '../db.js';

const router = Router();

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Teacher routes are working',
    timestamp: new Date().toISOString()
  });
});

// Get teacher's classes and info
router.get('/classes', authMiddleware, async (req, res) => {
  try {
    const teacherId = req.user?.id;
    
    if (!teacherId) {
      return res.status(400).json({ 
        success: false,
        message: 'Teacher ID required' 
      });
    }

    // Get teacher's class assignment from staff table
    const teacherRows = await query(
      'SELECT className, name, email FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Teacher not found' 
      });
    }

    const teacher = teacherRows[0];
    
    // Get students in teacher's class
    let students = [];
    if (teacher.className) {
      students = await query(
        'SELECT id, name, age, grade FROM children WHERE className = ?',
        [teacher.className],
        'skydek_DB'
      );
    }

    res.json({
      success: true,
      teacher: {
        id: teacherId,
        name: teacher.name,
        email: teacher.email,
        className: teacher.className
      },
      students: students,
      totalStudents: students.length,
      message: 'Teacher classes fetched successfully'
    });
    
  } catch (error) {
    console.error('Error in teacher classes endpoint:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching classes',
      error: error.message 
    });
  }
});

// Get homework assigned by teacher
router.get('/homework', authMiddleware, async (req, res) => {
  try {
    const teacherId = req.user?.id;
    
    if (!teacherId) {
      return res.status(400).json({ 
        success: false,
        message: 'Teacher ID required' 
      });
    }

    // Get teacher's class first
    const teacherRows = await query(
      'SELECT className FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Teacher not found' 
      });
    }

    const teacherClass = teacherRows[0].className;

    // Get homework assigned by this teacher
    const homework = await query(
      'SELECT id, title, instructions, due_date, status, class_name, grade, created_at FROM homeworks WHERE uploaded_by_teacher_id = ? ORDER BY created_at DESC',
      [teacherId],
      'skydek_DB'
    );

    // Get submission count for each homework
    const homeworkWithStats = await Promise.all(homework.map(async (hw) => {
      const submissions = await query(
        'SELECT COUNT(*) as count FROM homework_submissions WHERE homework_id = ?',
        [hw.id],
        'skydek_DB'
      );
      
      return {
        ...hw,
        submissionCount: submissions[0]?.count || 0
      };
    }));

    res.json({
      success: true,
      homework: homeworkWithStats,
      totalHomework: homework.length,
      teacherClass: teacherClass,
      message: 'Teacher homework fetched successfully'
    });
    
  } catch (error) {
    console.error('Error in teacher homework endpoint:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching homework',
      error: error.message 
    });
  }
});

// Get teacher statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const teacherId = req.user?.id;
    
    if (!teacherId) {
      return res.status(400).json({ 
        success: false,
        message: 'Teacher ID required' 
      });
    }

    // Get teacher's class
    const teacherRows = await query(
      'SELECT className FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Teacher not found' 
      });
    }

    const teacherClass = teacherRows[0].className;

    // Get homework count
    const homeworkCount = await query(
      'SELECT COUNT(*) as count FROM homeworks WHERE uploaded_by_teacher_id = ?',
      [teacherId],
      'skydek_DB'
    );

    // Get submission count for teacher's homework
    const submissionCount = await query(
      `SELECT COUNT(*) as count FROM homework_submissions hs 
       JOIN homeworks h ON hs.homework_id = h.id 
       WHERE h.uploaded_by_teacher_id = ?`,
      [teacherId],
      'skydek_DB'
    );

    // Get student count in teacher's class
    const studentCount = await query(
      'SELECT COUNT(*) as count FROM children WHERE className = ?',
      [teacherClass || ''],
      'skydek_DB'
    );

    // Calculate submission rate
    const totalHomework = homeworkCount[0]?.count || 0;
    const totalSubmissions = submissionCount[0]?.count || 0;
    const totalStudents = studentCount[0]?.count || 0;
    const submissionRate = totalHomework > 0 && totalStudents > 0 ? 
      (totalSubmissions / (totalHomework * totalStudents)) * 100 : 0;

    res.json({
      success: true,
      stats: {
        totalHomework: totalHomework,
        totalSubmissions: totalSubmissions,
        totalStudents: totalStudents,
        submissionRate: Math.min(100, submissionRate)
      },
      teacherClass: teacherClass,
      message: 'Teacher stats fetched successfully'
    });
    
  } catch (error) {
    console.error('Error in teacher stats endpoint:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching stats',
      error: error.message 
    });
  }
});

// Get attendance for teacher's classes (simplified)
router.get('/attendance', authMiddleware, async (req, res) => {
  try {
    const teacherId = req.user?.id;
    
    if (!teacherId) {
      return res.status(400).json({ 
        success: false,
        message: 'Teacher ID required' 
      });
    }

    // Get teacher's class
    const teacherRows = await query(
      'SELECT className FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Teacher not found' 
      });
    }

    const teacherClass = teacherRows[0].className;

    // Get recent attendance records for teacher's class
    const attendance = await query(
      `SELECT a.*, c.name as child_name 
       FROM attendance a 
       JOIN children c ON a.child_id = c.id 
       WHERE c.className = ? 
       ORDER BY a.date DESC 
       LIMIT 50`,
      [teacherClass || ''],
      'skydek_DB'
    );

    res.json({
      success: true,
      attendance: attendance,
      teacherClass: teacherClass,
      message: 'Teacher attendance fetched successfully'
    });
    
  } catch (error) {
    console.error('Error in teacher attendance endpoint:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching attendance',
      error: error.message 
    });
  }
});

export default router; 