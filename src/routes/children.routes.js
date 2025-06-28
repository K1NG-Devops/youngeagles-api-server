import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware, isTeacher } from '../middleware/authMiddleware.js';

const router = Router();

// Get children for a specific teacher
router.get('/teacher/:teacherId', [authMiddleware, isTeacher], async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    // Get teacher's class first
    const [teacherClass] = await query(
      'SELECT className FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (!teacherClass) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    // Get all children in teacher's class
    const children = await query(
      'SELECT c.*, u.name as parent_name FROM children c LEFT JOIN users u ON c.parent_id = u.id WHERE c.className = ? ORDER BY c.name',
      [teacherClass.className],
      'skydek_DB'
    );

    res.json({
      success: true,
      children: children || [],
      count: children ? children.length : 0
    });
  } catch (error) {
    console.error('Error fetching children for teacher:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching children',
      error: error.message
    });
  }
});

export default router; 