import express from 'express';
import { verifyTokenMiddleware } from '../utils/security.js';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get All Classes (filtered by user role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let classes;

    // If user is a teacher, only return their assigned class
    if (req.user.userType === 'teacher') {
      // Get teacher's assigned class
      const [teacher] = await query(
        'SELECT className FROM staff WHERE id = ? AND role = ?',
        [req.user.id, 'teacher']
      );

      if (!teacher || !teacher.className) {
        return res.json({
          success: true,
          classes: [],
          message: 'No class assigned to teacher'
        });
      }

      // Get only the teacher's assigned class
      classes = await query(`
        SELECT DISTINCT
          className as name,
          className as id,
          COUNT(c.id) as student_count
        FROM children c
        WHERE className = ?
        GROUP BY className
        ORDER BY className ASC
      `, [teacher.className]);
    } else {
      // Admin or other users can see all classes
      classes = await query(`
        SELECT DISTINCT
          className as name,
          className as id,
          COUNT(c.id) as student_count
        FROM children c
        WHERE className IS NOT NULL AND className != ''
        GROUP BY className
        ORDER BY className ASC
      `);
    }

    res.json({
      success: true,
      classes
    });

  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch classes'
    });
  }
});

// Get Children by Class
router.get('/:classId/children', authenticateToken, async (req, res) => {
  try {
    const { classId } = req.params;

    const children = await query(`
      SELECT 
        c.id,
        c.name,
        c.className,
        c.grade,
        c.age,
        c.parent_id,
        u.name as parent_name,
        u.email as parent_email
      FROM children c
      LEFT JOIN users u ON c.parent_id = u.id
      WHERE c.className = ?
      ORDER BY c.name ASC
    `, [classId]);

    res.json({
      success: true,
      children
    });

  } catch (error) {
    console.error('Error fetching children by class:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch children for class'
    });
  }
});

// Get Class by ID/Name
router.get('/:classId', authenticateToken, async (req, res) => {
  try {
    const { classId } = req.params;

    // Get class info with student count
    const [classInfo] = await query(`
      SELECT 
        className as name,
        className as id,
        COUNT(c.id) as student_count
      FROM children c
      WHERE className = ?
      GROUP BY className
    `, [classId]);

    if (!classInfo) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    res.json({
      success: true,
      class: classInfo
    });

  } catch (error) {
    console.error('Error fetching class:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch class'
    });
  }
});

// Get teacher's classes (for teacher dashboard)
router.get('/teacher/:teacherId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { teacherId } = req.params;

    // Only the teacher themselves or admin can view
    if (req.user.userType !== 'admin' && (req.user.userType !== 'teacher' || req.user.id !== parseInt(teacherId))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get teacher's assigned class info
    const [teacher] = await query(
      'SELECT name, className FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher']
    );

    if (!teacher || !teacher.className) {
      return res.json({
        success: true,
        classes: [],
        message: 'No class assigned to teacher'
      });
    }

    const classes = await query(`
      SELECT 
        cl.id,
        cl.name,
        ? as teacher_name,
        COUNT(ch.id) as student_count
      FROM classes cl
      LEFT JOIN children ch ON cl.id = ch.class_id
      WHERE cl.name = ?
      GROUP BY cl.id
      ORDER BY cl.name
    `, [teacher.name || 'Teacher', teacher.className]);

    res.json({
      success: true,
      classes
    });

  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 