import express from 'express';
import { verifyToken } from '../utils/security.js';
import { db } from '../db.js';

const router = express.Router();

// Get notifications for authenticated user
router.get('/', async (req, res) => {
  console.log('🔔 Fetching notifications for user');
  
  try {
    // Verify authentication
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'UNAUTHORIZED'
      });
    }

    const userId = user.id;
    const userType = user.role; // 'admin', 'teacher', 'parent'
    
    console.log(`📋 Getting notifications for user ${userId} (${userType})`);

    if (!db) {
      console.log('⚠️ Database not available - returning empty notifications');
      return res.json({
        success: true,
        notifications: [],
        total: 0,
        message: 'Database not available'
      });
    }

    // Get notifications with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const unreadOnly = req.query.unread === 'true';

    let whereClause = 'WHERE userId = ? AND userType = ?';
    let queryParams = [userId, userType];

    if (unreadOnly) {
      whereClause += ' AND isRead = FALSE';
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM notifications 
      ${whereClause}
    `;
    
    const [countResult] = await db.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // Debug logging
    console.log('🔍 Debug info:', {
      userId,
      userType,
      limit,
      offset,
      queryParams,
      whereClause
    });

    // Get notifications with manual LIMIT/OFFSET to avoid parameter binding issues
    const notificationsQuery = `
      SELECT 
        id,
        type,
        title,
        body as message,
        data,
        isRead,
        priority,
        createdAt,
        sentAt
      FROM notifications 
      ${whereClause}
      ORDER BY createdAt DESC 
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;

    console.log('🔍 Executing query:', notificationsQuery);
    console.log('🔍 With params:', queryParams);
    
    const [notifications] = await db.execute(notificationsQuery, queryParams);

    console.log(`✅ Found ${notifications.length} notifications for user ${userId}`);

    res.json({
      success: true,
      notifications: notifications.map(notification => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        read: notification.isRead,
        priority: notification.priority,
        date: notification.createdAt,
        created_at: notification.createdAt,
        sent_at: notification.sentAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unread_count: notifications.filter(n => !n.isRead).length
    });

  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: 'INTERNAL_ERROR'
    });
  }
});

// Mark notification as read
router.patch('/read/:id', async (req, res) => {
  console.log('📖 Marking notification as read:', req.params.id);
  
  try {
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!db) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    const notificationId = req.params.id;
    const userId = user.id;
    const userType = user.role;

    // Update notification as read (only if it belongs to the user)
    const updateQuery = `
      UPDATE notifications 
      SET isRead = TRUE, sentAt = NOW() 
      WHERE id = ? AND userId = ? AND userType = ?
    `;

    const [result] = await db.execute(updateQuery, [notificationId, userId, userType]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access denied'
      });
    }

    console.log(`✅ Notification ${notificationId} marked as read`);
    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read
router.patch('/read-all', async (req, res) => {
  console.log('📖 Marking all notifications as read');
  
  try {
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!db) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    const userId = user.id;
    const userType = user.role;

    const updateQuery = `
      UPDATE notifications 
      SET isRead = TRUE, sentAt = NOW() 
      WHERE userId = ? AND userType = ? AND isRead = FALSE
    `;

    const [result] = await db.execute(updateQuery, [userId, userType]);

    console.log(`✅ Marked ${result.affectedRows} notifications as read`);
    res.json({
      success: true,
      message: `Marked ${result.affectedRows} notifications as read`,
      updated_count: result.affectedRows
    });

  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
});

// Create notification (admin only)
router.post('/', async (req, res) => {
  console.log('🔔 Creating new notification');
  
  try {
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Only admins can create notifications
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    if (!db) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    const {
      userId,
      userType,
      type,
      title,
      message,
      priority = 'normal',
      data = null
    } = req.body;

    // Validate required fields
    if (!userId || !userType || !type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, userType, type, title, message'
      });
    }

    const insertQuery = `
      INSERT INTO notifications (
        userId, userType, type, title, body, 
        priority, data, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const [result] = await db.execute(insertQuery, [
      userId, userType, type, title, message,
      priority, JSON.stringify(data)
    ]);

    console.log(`✅ Created notification ${result.insertId}`);
    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      notification_id: result.insertId
    });

  } catch (error) {
    console.error('❌ Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification'
    });
  }
});

// Delete notification
router.delete('/:id', async (req, res) => {
  console.log('🗑️ Deleting notification:', req.params.id);
  
  try {
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!db) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    const notificationId = req.params.id;
    const userId = user.id;
    const userType = user.role;

    // Delete notification (only if it belongs to the user)
    const deleteQuery = `
      DELETE FROM notifications 
      WHERE id = ? AND userId = ? AND userType = ?
    `;

    const [result] = await db.execute(deleteQuery, [notificationId, userId, userType]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access denied'
      });
    }

    console.log(`✅ Deleted notification ${notificationId}`);
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
});

// Get unread count
router.get('/unread-count', async (req, res) => {
  try {
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!db) {
      return res.json({
        success: true,
        unread_count: 0
      });
    }

    const userId = user.id;
    const userType = user.role;

    const countQuery = `
      SELECT COUNT(*) as unread_count 
      FROM notifications 
      WHERE userId = ? AND userType = ? AND isRead = FALSE
    `;

    const [result] = await db.execute(countQuery, [userId, userType]);
    const unreadCount = result[0].unread_count;

    res.json({
      success: true,
      unread_count: unreadCount
    });

  } catch (error) {
    console.error('❌ Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count'
    });
  }
});

export default router;
