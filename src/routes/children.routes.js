import express from 'express';
import { verifyTokenMiddleware } from '../utils/security.js';
import { query } from '../db.js';

const router = express.Router();

// Get children for a parent
router.get('/parent/:parentId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { parentId } = req.params;

    // Verify the requesting user is the parent or admin
    if (req.user.userType !== 'admin' && req.user.id !== parseInt(parentId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get children with class and teacher info
    const children = await query(`
      SELECT 
        c.*,
        cl.name as class_name,
        s.name as teacher_name,
        s.email as teacher_email
      FROM children c
      LEFT JOIN classes cl ON c.class_id = cl.id
      LEFT JOIN staff s ON cl.teacher_id = s.id
      WHERE c.parent_id = ?
      ORDER BY c.first_name
    `, [parentId]);

    res.json({
      success: true,
      children
    });

  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all children (admin/teacher only)
router.get('/', verifyTokenMiddleware, async (req, res) => {
  try {
    // Only admin and teachers can view all children
    if (req.user.userType !== 'admin' && req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // For teachers, only show children in their classes
    let children;
    if (req.user.userType === 'teacher') {
      // Get teacher's assigned class
      const [teacher] = await query(
        'SELECT className FROM staff WHERE id = ? AND role = ?',
        [req.user.id, 'teacher']
      );

      if (!teacher || !teacher.className) {
        return res.json({
          success: true,
          children: [],
          message: 'No class assigned to teacher'
        });
      }

      children = await query(`
        SELECT 
          c.*,
          u.name as parent_name,
          u.email as parent_email,
          u.phone as parent_phone,
          cl.name as class_name,
          ? as teacher_name
        FROM children c
        LEFT JOIN users u ON c.parent_id = u.id
        LEFT JOIN classes cl ON c.class_id = cl.id
        WHERE cl.name = ?
        ORDER BY c.first_name
      `, [req.user.name || 'Teacher', teacher.className]);
    } else {
      // Admin can see all children
      children = await query(`
        SELECT 
          c.*,
          u.name as parent_name,
          u.email as parent_email,
          u.phone as parent_phone,
          cl.name as class_name,
          'Admin View' as teacher_name
        FROM children c
        LEFT JOIN users u ON c.parent_id = u.id
        LEFT JOIN classes cl ON c.class_id = cl.id
        ORDER BY cl.name, c.first_name
      `);
    }

    res.json({
      success: true,
      children
    });

  } catch (error) {
    console.error('Error fetching all children:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get child by ID
router.get('/:childId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { childId } = req.params;

    // Get child with all related info
    const children = await query(`
      SELECT 
        c.*,
        u.name as parent_name,
        u.email as parent_email,
        u.phone as parent_phone,
        cl.name as class_name,
        s.name as teacher_name,
        s.email as teacher_email
      FROM children c
      LEFT JOIN users u ON c.parent_id = u.id
      LEFT JOIN classes cl ON c.class_id = cl.id
      LEFT JOIN staff s ON cl.teacher_id = s.id
      WHERE c.id = ?
    `, [childId]);

    if (children.length === 0) {
      return res.status(404).json({ error: 'Child not found' });
    }

    const child = children[0];

    // Verify access permissions
    if (req.user.userType === 'parent' && req.user.id !== child.parent_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.userType === 'teacher') {
      // For teachers, check if child is in their assigned class
      const [teacher] = await query(
        'SELECT className FROM staff WHERE id = ? AND role = ?',
        [req.user.id, 'teacher']
      );
      
      if (!teacher || teacher.className !== child.class_name) {
        return res.status(403).json({ error: 'Access denied - child not in your class' });
      }
    }

    res.json({
      success: true,
      child
    });

  } catch (error) {
    console.error('Error fetching child:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 