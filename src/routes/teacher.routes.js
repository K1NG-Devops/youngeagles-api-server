import express from 'express';
import { verifyTokenMiddleware } from '../utils/security.js';
import { query } from '../db.js';

const router = express.Router();

// Get teacher's profile and assigned class
router.get('/profile', verifyTokenMiddleware, async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied - teachers only' });
    }

    // Get teacher info from staff table
    const [teacher] = await query(
      'SELECT id, name, email, className, role FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher']
    );

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    res.json({
      success: true,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        className: teacher.className,
        role: teacher.role
      }
    });

  } catch (error) {
    console.error('Error fetching teacher profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get students in teacher's class only
router.get('/students', verifyTokenMiddleware, async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied - teachers only' });
    }

    // Get teacher's class assignment
    const [teacher] = await query(
      'SELECT className FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher']
    );

    if (!teacher || !teacher.className) {
      return res.status(404).json({ 
        success: true, 
        students: [], 
        className: null,
        message: 'No class assigned to teacher' 
      });
    }

    // Get students in teacher's class only
    const students = await query(`
      SELECT 
        c.id,
        c.first_name,
        c.last_name,
        c.age,
        c.grade,
        c.parent_id,
        u.name as parent_name,
        u.email as parent_email
      FROM children c
      LEFT JOIN users u ON c.parent_id = u.id
      WHERE c.class_id = (SELECT id FROM classes WHERE name = ?)
      ORDER BY c.first_name
    `, [teacher.className]);

    res.json({
      success: true,
      students,
      className: teacher.className,
      totalStudents: students.length
    });

  } catch (error) {
    console.error('Error fetching teacher students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get homework for teacher's class only
router.get('/homework', verifyTokenMiddleware, async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied - teachers only' });
    }

    console.log(`👩‍🏫 Fetching homework for teacher ${teacherId}`);

    // Get homework created by this teacher with proper assignment type handling
    const homework = await query(`
      SELECT 
        h.*,
        cl.name as class_name,
        COUNT(DISTINCT hs.id) as submissions_count,
        CASE 
          WHEN h.assignment_type = 'individual' THEN (
            SELECT COUNT(*) FROM homework_individual_assignments hia WHERE hia.homework_id = h.id
          )
          ELSE COUNT(DISTINCT c.id)
        END as total_students,
        CASE 
          WHEN h.assignment_type = 'individual' THEN 'Individual Assignment'
          ELSE 'Class Assignment'
        END as assignment_scope
      FROM homework h
      LEFT JOIN classes cl ON cl.id = h.class_id
      LEFT JOIN children c ON c.class_id = h.class_id
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id
      WHERE h.teacher_id = ? AND h.status = 'active'
      GROUP BY h.id
      ORDER BY h.created_at DESC, h.due_date DESC
    `, [teacherId]);

    console.log(`📚 Found ${homework.length} homework assignments for teacher ${teacherId}`);

    // Add individual assignment details for each homework
    for (let hw of homework) {
      if (hw.assignment_type === 'individual') {
        const individualAssignments = await query(`
          SELECT 
            c.id,
            c.first_name,
            c.last_name,
            hia.status as assignment_status,
            hia.assigned_at
          FROM homework_individual_assignments hia
          JOIN children c ON c.id = hia.child_id
          WHERE hia.homework_id = ?
          ORDER BY c.first_name
        `, [hw.id]);
        
        hw.assigned_students = individualAssignments;
        hw.total_students = individualAssignments.length;
      }
    }

    res.json({
      success: true,
      homework,
      totalHomework: homework.length
    });

  } catch (error) {
    console.error('Error fetching teacher homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get teacher's class statistics
router.get('/stats', verifyTokenMiddleware, async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied - teachers only' });
    }

    // Get teacher's class
    const [teacher] = await query(
      'SELECT className FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher']
    );

    if (!teacher || !teacher.className) {
      return res.json({
        success: true,
        stats: {
          totalStudents: 0,
          totalHomework: 0,
          totalSubmissions: 0,
          submissionRate: 0
        },
        className: null
      });
    }

    // Get class ID
    const [classInfo] = await query(
      'SELECT id FROM classes WHERE name = ?',
      [teacher.className]
    );

    if (!classInfo) {
      return res.json({
        success: true,
        stats: {
          totalStudents: 0,
          totalHomework: 0,
          totalSubmissions: 0,
          submissionRate: 0
        },
        className: teacher.className
      });
    }

    const classId = classInfo.id;

    // Get statistics for teacher's class only
    const [studentCount] = await query(
      'SELECT COUNT(*) as count FROM children WHERE class_id = ?',
      [classId]
    );

    const [homeworkCount] = await query(
      'SELECT COUNT(*) as count FROM homework WHERE teacher_id = ?',
      [teacherId]
    );

    const [submissionCount] = await query(`
      SELECT COUNT(*) as count 
      FROM homework_submissions hs
      JOIN homework h ON hs.homework_id = h.id
      WHERE h.teacher_id = ?
    `, [teacherId]);

    const totalStudents = studentCount.count || 0;
    const totalHomework = homeworkCount.count || 0;
    const totalSubmissions = submissionCount.count || 0;
    const submissionRate = totalHomework > 0 && totalStudents > 0 
      ? Math.round((totalSubmissions / (totalHomework * totalStudents)) * 100) 
      : 0;

    res.json({
      success: true,
      stats: {
        totalStudents,
        totalHomework,
        totalSubmissions,
        submissionRate
      },
      className: teacher.className
    });

  } catch (error) {
    console.error('Error fetching teacher stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get assignments for teacher's class only
router.get('/assignments', verifyTokenMiddleware, async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied - teachers only' });
    }

    // Get assignments created by this teacher
    const assignments = await query(`
      SELECT 
        h.id,
        h.title,
        h.description,
        h.due_date,
        h.created_at,
        cl.name as class_name,
        COUNT(DISTINCT hs.id) as submissions_count,
        COUNT(DISTINCT c.id) as total_students,
        CASE 
          WHEN h.due_date < NOW() THEN 'overdue'
          WHEN h.due_date > NOW() THEN 'active'
          ELSE 'due_today'
        END as status
      FROM homework h
      LEFT JOIN classes cl ON cl.id = h.class_id
      LEFT JOIN children c ON c.class_id = h.class_id
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id
      WHERE h.teacher_id = ?
      GROUP BY h.id
      ORDER BY h.due_date ASC
    `, [teacherId]);

    res.json({
      success: true,
      assignments,
      totalAssignments: assignments.length
    });

  } catch (error) {
    console.error('Error fetching teacher assignments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 