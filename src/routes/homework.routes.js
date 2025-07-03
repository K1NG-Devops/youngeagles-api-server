import express from 'express';
import { verifyTokenMiddleware } from '../utils/security.js';
import { query } from '../db.js';

const router = express.Router();

// Get homework for a parent's children
router.get('/parent/:parentId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { parentId } = req.params;
    const { childId } = req.query; // Optional child filter

    // Verify the requesting user is the parent or admin
    if (req.user.userType !== 'admin' && req.user.id !== parseInt(parentId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Base query to get homework for children - Fixed table names and columns
    let sql = `
      SELECT 
        h.*,
        c.first_name as child_name,
        c.last_name as child_last_name,
        cl.name as class_name,
        s.name as teacher_name,
        s.email as teacher_email,
        CASE 
          WHEN h.due_date < NOW() AND (hs.id IS NULL) THEN 'overdue'
          WHEN hs.id IS NOT NULL THEN 'submitted'
          ELSE 'pending'
        END as status,
        hs.submitted_at,
        hs.grade,
        hs.feedback as teacher_feedback,
        hs.file_url as attachment_url,
        hs.feedback as submission_text
      FROM children c
      JOIN classes cl ON cl.id = c.class_id
      JOIN homework h ON h.class_id = cl.id
      LEFT JOIN staff s ON s.id = h.teacher_id
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.child_id = c.id
      WHERE c.parent_id = ?
    `;

    const params = [parentId];

    // Add child filter if specified
    if (childId) {
      sql += ' AND c.id = ?';
      params.push(childId);
    }

    // Add order by
    sql += ' ORDER BY h.due_date DESC, c.first_name';

    const homework = await query(sql, params);

    // Get children list for the parent (for the selector)
    const children = await query(`
      SELECT 
        c.id,
        c.first_name,
        c.last_name,
        cl.name as class_name
      FROM children c
      LEFT JOIN classes cl ON cl.id = c.class_id
      WHERE c.parent_id = ?
      ORDER BY c.first_name
    `, [parentId]);

    res.json({
      success: true,
      homework,
      children
    });

  } catch (error) {
    console.error('Error fetching homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get homework for a specific class (teacher only)
router.get('/class/:classId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { classId } = req.params;

    // Verify the requesting user is the teacher of this class or admin
    if (req.user.userType !== 'admin') {
      // For teachers, check if they are assigned to this class
      if (req.user.userType === 'teacher') {
        const [teacher] = await query(
          'SELECT className FROM staff WHERE id = ? AND role = ?',
          [req.user.id, 'teacher']
        );
        
        if (!teacher || !teacher.className) {
          return res.status(403).json({ error: 'Teacher not assigned to any class' });
        }

        // Get class info to verify teacher assignment
        const [classInfo] = await query(
          'SELECT name FROM classes WHERE id = ?',
          [classId]
        );

        if (!classInfo || classInfo.name !== teacher.className) {
          return res.status(403).json({ error: 'Access denied - not your class' });
        }
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Get all homework for the class - Fixed table names
    const homework = await query(`
      SELECT 
        h.*,
        cl.name as class_name,
        s.name as teacher_name,
        COUNT(DISTINCT hs.id) as submissions_count,
        COUNT(DISTINCT c.id) as total_students
      FROM homework h
      LEFT JOIN classes cl ON cl.id = h.class_id
      LEFT JOIN staff s ON s.id = h.teacher_id
      LEFT JOIN children c ON c.class_id = h.class_id
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.child_id = c.id
      WHERE h.class_id = ?
      GROUP BY h.id
      ORDER BY h.due_date DESC
    `, [classId]);

    res.json({
      success: true,
      homework
    });

  } catch (error) {
    console.error('Error fetching class homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get homework for a specific teacher
router.get('/teacher/:teacherId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { teacherId } = req.params;

    // Verify the requesting user is the teacher themselves or admin
    if (req.user.userType !== 'admin' && (req.user.userType !== 'teacher' || req.user.id !== parseInt(teacherId))) {
      return res.status(403).json({ error: 'Access denied - you can only view your own homework' });
    }

    // Get teacher info to get their assigned class
    const [teacher] = await query(
      'SELECT id, name, email, className, role FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher']
    );

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    if (!teacher.className) {
      return res.status(404).json({ error: 'Teacher not assigned to any class' });
    }

    // Get the class ID for the teacher's assigned class
    const [classInfo] = await query(
      'SELECT id FROM classes WHERE name = ?',
      [teacher.className]
    );

    if (!classInfo) {
      return res.status(404).json({ error: 'Teacher assigned class not found' });
    }

    // Get all homework created by this teacher for their class
    const homework = await query(`
      SELECT 
        h.*,
        cl.name as class_name,
        s.name as teacher_name,
        COUNT(DISTINCT hs.id) as submissions_count,
        COUNT(DISTINCT c.id) as total_students,
        COUNT(DISTINCT CASE WHEN hs.id IS NOT NULL THEN hs.id END) as submitted_count,
        COUNT(DISTINCT CASE WHEN h.due_date < NOW() AND hs.id IS NULL THEN c.id END) as overdue_count
      FROM homework h
      LEFT JOIN classes cl ON cl.id = h.class_id
      LEFT JOIN staff s ON s.id = h.teacher_id
      LEFT JOIN children c ON c.class_id = h.class_id
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.child_id = c.id
      WHERE h.teacher_id = ? AND h.class_id = ?
      GROUP BY h.id
      ORDER BY h.due_date DESC
    `, [teacherId, classInfo.id]);

    // Get teacher's class statistics
    const [stats] = await query(`
      SELECT 
        COUNT(DISTINCT c.id) as total_students,
        COUNT(DISTINCT h.id) as total_homework,
        COUNT(DISTINCT hs.id) as total_submissions
      FROM classes cl
      LEFT JOIN children c ON c.class_id = cl.id
      LEFT JOIN homework h ON h.class_id = cl.id AND h.teacher_id = ?
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id
      WHERE cl.id = ?
    `, [teacherId, classInfo.id]);

    res.json({
      success: true,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        className: teacher.className
      },
      homework,
      stats: stats || {
        total_students: 0,
        total_homework: 0,
        total_submissions: 0
      }
    });

  } catch (error) {
    console.error('Error fetching teacher homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get homework details with submissions
router.get('/:homeworkId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { homeworkId } = req.params;

    // Get homework details - Fixed table names
    const [homework] = await query(`
      SELECT 
        h.*,
        cl.name as class_name,
        s.name as teacher_name,
        s.email as teacher_email
      FROM homework h
      LEFT JOIN classes cl ON cl.id = h.class_id
      LEFT JOIN staff s ON s.id = h.teacher_id
      WHERE h.id = ?
    `, [homeworkId]);

    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }

    // Get submissions for this homework - Fixed table and column names
    const submissions = await query(`
      SELECT 
        hs.*,
        c.first_name,
        c.last_name,
        u.name as parent_name,
        hs.file_url as file_name,
        hs.file_url,
        hs.submitted_at
      FROM homework_submissions hs
      JOIN children c ON hs.child_id = c.id
      JOIN users u ON c.parent_id = u.id
      WHERE hs.homework_id = ?
      ORDER BY hs.submitted_at DESC
    `, [homeworkId]);

    // Add submissions to homework object
    homework.submissions = submissions;

    res.json({
      success: true,
      homework
    });

  } catch (error) {
    console.error('Error fetching homework details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 