import express from 'express';
import { verifyTokenMiddleware } from '../utils/security.js';
import { query } from '../db.js';
import pushNotificationService from '../services/pushNotificationService.js';

const router = express.Router();

// Get all notifications for the current user
router.get('/', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get notifications for the user
    const notifications = await query(`
      SELECT 
        id,
        title,
        body as message,
        type,
        priority,
        isRead as \`read\`,
        'System' as sender,
        data,
        createdAt as timestamp
      FROM notifications 
      WHERE userId = ? 
      ORDER BY createdAt DESC 
      LIMIT 50
    `, [userId]);

    res.json({
      success: true,
      notifications: notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

// Get notification by ID
router.get('/:id', verifyTokenMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const [notification] = await query(`
      SELECT 
        id,
        title,
        body as message,
        type,
        priority,
        isRead as \`read\`,
        'System' as sender,
        data,
        createdAt as timestamp
      FROM notifications 
      WHERE id = ? AND userId = ?
    `, [id, userId]);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.json({
      success: true,
      notification: notification
    });
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification'
    });
  }
});

// Mark notification as read
router.post('/:id/read', verifyTokenMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await query(`
      UPDATE notifications 
      SET isRead = 1, updatedAt = NOW()
      WHERE id = ? AND userId = ?
    `, [id, userId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: `Notification ${id} marked as read`
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read
router.post('/mark-all-read', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    await query(`
      UPDATE notifications 
      SET isRead = 1, updatedAt = NOW()
      WHERE userId = ? AND isRead = 0
    `, [userId]);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
});

// Get unread notifications count
router.get('/unread/count', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [result] = await query(`
      SELECT COUNT(*) as count 
      FROM notifications 
      WHERE userId = ? AND isRead = 0
    `, [userId]);

    res.json({
      success: true,
      count: result.count
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread count'
    });
  }
});

// Send notification (admin/teacher only)
router.post('/send', verifyTokenMiddleware, async (req, res) => {
  try {
    const { 
      recipients,
      message,
      _type = 'info',
      _priority = 'normal',
      title
    } = req.body;
    const _senderId = req.user.id;
    const senderType = req.user.userType;
    
    // Verify user has permission to send notifications
    if (!['admin', 'teacher'].includes(senderType)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - admin or teacher required'
      });
    }

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Title and message are required'
      });
    }

    // Default to all parents if no specific recipients
    let targetRecipients = recipients || 'all';

    // Send push notification for announcements
    try {
      const pushResult = await pushNotificationService.sendAnnouncementNotification(
        title,
        message,
        targetRecipients
      );
      
      console.log(`📱 Push notification sent to ${pushResult.sent} parents, ${pushResult.failed} failed`);
      
      res.json({
        success: true,
        message: 'Notification sent successfully',
        pushResults: {
          sent: pushResult.sent,
          failed: pushResult.failed
        }
      });
    } catch (pushError) {
      console.error('Error sending push notification:', pushError);
      res.status(500).json({
        success: false,
        error: 'Failed to send push notification'
      });
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notification'
    });
  }
});

export default router;
