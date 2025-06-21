import { Router } from 'express';
import { query, execute } from '../db.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Get parent's children
router.get('/children', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.id;
    
    const children = await query(
      'SELECT * FROM children WHERE parent_id = ?',
      [parentId],
      'skydek_DB'
    );
    
    res.json({
      success: true,
      children: children || [],
      count: children ? children.length : 0
    });
  } catch (error) {
    console.error('Error fetching children for parent:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching children',
      error: error.message 
    });
  }
});

// Get parent's profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.id;
    
    const parent = await query(
      'SELECT id, name, email, phone, created_at FROM users WHERE id = ? AND role = ?',
      [parentId, 'parent'],
      'skydek_DB'
    );
    
    if (!parent || parent.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parent profile not found'
      });
    }
    
    res.json({
      success: true,
      profile: parent[0]
    });
  } catch (error) {
    console.error('Error fetching parent profile:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching profile',
      error: error.message 
    });
  }
});

// Get homework for parent's children
router.get('/homework', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.id;
    
    // First get parent's children
    const children = await query(
      'SELECT id, name, className, grade FROM children WHERE parent_id = ?',
      [parentId],
      'skydek_DB'
    );
    
    if (!children || children.length === 0) {
      return res.json({
        success: true,
        homework: [],
        message: 'No children found for this parent'
      });
    }
    
    // Get homework for all children
    const homework = await query(
      `SELECT h.*, s.submitted_at, s.file_url as submission_file, s.comment as submission_comment
       FROM homeworks h
       LEFT JOIN submissions s ON h.id = s.homework_id AND s.parent_id = ?
       WHERE h.className IN (${children.map(() => '?').join(',')}) 
       ORDER BY h.due_date DESC`,
      [parentId, ...children.map(child => child.className)],
      'skydek_DB'
    );
    
    res.json({
      success: true,
      homework: homework || [],
      children: children,
      count: homework ? homework.length : 0
    });
  } catch (error) {
    console.error('Error fetching homework for parent:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching homework',
      error: error.message 
    });
  }
});

// Get parent's notifications
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.id;
    
    const notifications = await query(
      `SELECT * FROM notifications 
       WHERE user_id = ? AND user_type = 'parent' 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [parentId],
      'skydek_DB'
    );
    
    res.json({
      success: true,
      notifications: notifications || [],
      count: notifications ? notifications.length : 0
    });
  } catch (error) {
    console.error('Error fetching notifications for parent:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching notifications',
      error: error.message 
    });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.id;
    const notificationId = req.params.id;
    
    await execute(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ? AND user_type = ?',
      [notificationId, parentId, 'parent'],
      'skydek_DB'
    );
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating notification',
      error: error.message 
    });
  }
});

// Get parent's dashboard data
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user.id;
    
    // Get children count
    const childrenCount = await query(
      'SELECT COUNT(*) as count FROM children WHERE parent_id = ?',
      [parentId],
      'skydek_DB'
    );
    
    // Get pending homework count
    const pendingHomework = await query(
      `SELECT COUNT(*) as count FROM homeworks h
       INNER JOIN children c ON h.className = c.className
       LEFT JOIN submissions s ON h.id = s.homework_id AND s.parent_id = ?
       WHERE c.parent_id = ? AND s.id IS NULL AND h.due_date >= CURDATE()`,
      [parentId, parentId],
      'skydek_DB'
    );
    
    // Get unread notifications count
    const unreadNotifications = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND user_type = ? AND is_read = FALSE',
      [parentId, 'parent'],
      'skydek_DB'
    );
    
    res.json({
      success: true,
      dashboard: {
        childrenCount: childrenCount[0]?.count || 0,
        pendingHomework: pendingHomework[0]?.count || 0,
        unreadNotifications: unreadNotifications[0]?.count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data for parent:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message 
    });
  }
});

export default router; 