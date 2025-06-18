import { query, execute } from '../db.js';
import { sendPushNotification } from '../utils/pushNotifications.js';
import logger from '../utils/logger.js';

// Send a new message
export const sendMessage = async (req, res) => {
  const { recipient_id, recipient_type, subject, message, message_type = 'text', is_urgent = false, child_id } = req.body;
  const sender_id = req.user.id;
  const sender_type = req.user.role;

  try {
    // Insert the message
    const result = await execute(
      `INSERT INTO messages (sender_id, sender_type, recipient_id, recipient_type, subject, message, message_type, is_urgent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sender_id, sender_type, recipient_id, recipient_type, subject, message, message_type, is_urgent],
      'skydek_DB'
    );

    const messageId = result.insertId;

    // Create notification for recipient
    await createNotification({
      user_id: recipient_id,
      user_type: recipient_type,
      title: `New message from ${req.user.name}`,
      message: subject || message.substring(0, 100) + '...',
      notification_type: 'message',
      priority: is_urgent ? 'urgent' : 'normal',
      action_url: `/messages/${messageId}`,
      related_id: messageId
    });

    // Send push notification
    await sendMessageNotification(recipient_id, recipient_type, {
      title: `New message from ${req.user.name}`,
      body: subject || message.substring(0, 100),
      data: { messageId, type: 'message' }
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      messageId
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
};

// Get messages for a user
export const getMessages = async (req, res) => {
  const user_id = req.user.id;
  const user_type = req.user.role;
  const { page = 1, limit = 20, type = 'all' } = req.query;
  const offset = (page - 1) * limit;

  try {
    let whereClause = 'WHERE (recipient_id = ? AND recipient_type = ?) OR (sender_id = ? AND sender_type = ?)';
    let params = [user_id, user_type, user_id, user_type];

    if (type !== 'all') {
      whereClause += ' AND message_type = ?';
      params.push(type);
    }

    const messages = await query(
      `SELECT m.*, 
              sender.name as sender_name, 
              recipient.name as recipient_name
       FROM messages m
       LEFT JOIN users sender ON m.sender_id = sender.id AND m.sender_type = 'parent'
       LEFT JOIN users recipient ON m.recipient_id = recipient.id AND m.recipient_type = 'parent'
       ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset],
      'skydek_DB'
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM messages m ${whereClause}`,
      params,
      'skydek_DB'
    );

    res.json({
      success: true,
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
};

// Get conversation thread between two users
export const getConversation = async (req, res) => {
  const { otherUserId, otherUserType } = req.params;
  const user_id = req.user.id;
  const user_type = req.user.role;

  try {
    const messages = await query(
      `SELECT m.*, 
              sender.name as sender_name, 
              recipient.name as recipient_name
       FROM messages m
       LEFT JOIN users sender ON m.sender_id = sender.id
       LEFT JOIN users recipient ON m.recipient_id = recipient.id
       WHERE ((m.sender_id = ? AND m.sender_type = ? AND m.recipient_id = ? AND m.recipient_type = ?)
           OR (m.sender_id = ? AND m.sender_type = ? AND m.recipient_id = ? AND m.recipient_type = ?))
       ORDER BY m.created_at ASC`,
      [user_id, user_type, otherUserId, otherUserType, otherUserId, otherUserType, user_id, user_type],
      'skydek_DB'
    );

    // Mark messages as read
    await execute(
      `UPDATE messages SET is_read = TRUE 
       WHERE recipient_id = ? AND recipient_type = ? AND sender_id = ? AND sender_type = ?`,
      [user_id, user_type, otherUserId, otherUserType],
      'skydek_DB'
    );

    res.json({ success: true, messages });
  } catch (error) {
    logger.error('Error fetching conversation:', error);
    res.status(500).json({ message: 'Failed to fetch conversation' });
  }
};

// Mark message as read
export const markAsRead = async (req, res) => {
  const { messageId } = req.params;
  const user_id = req.user.id;
  const user_type = req.user.role;

  try {
    await execute(
      'UPDATE messages SET is_read = TRUE WHERE id = ? AND recipient_id = ? AND recipient_type = ?',
      [messageId, user_id, user_type],
      'skydek_DB'
    );

    res.json({ success: true, message: 'Message marked as read' });
  } catch (error) {
    logger.error('Error marking message as read:', error);
    res.status(500).json({ message: 'Failed to mark message as read' });
  }
};

// Get unread message count
export const getUnreadCount = async (req, res) => {
  const user_id = req.user.id;
  const user_type = req.user.role;

  try {
    const result = await query(
      'SELECT COUNT(*) as unread_count FROM messages WHERE recipient_id = ? AND recipient_type = ? AND is_read = FALSE',
      [user_id, user_type],
      'skydek_DB'
    );

    res.json({ success: true, unread_count: result[0].unread_count });
  } catch (error) {
    logger.error('Error getting unread count:', error);
    res.status(500).json({ message: 'Failed to get unread count' });
  }
};

// Get contact list for messaging
export const getContacts = async (req, res) => {
  const user_type = req.user.role;
  const user_id = req.user.id;

  try {
    let contacts = [];

    if (user_type === 'parent') {
      // Parents can message teachers and admins
      const teachers = await query(
        'SELECT id, name, email, "teacher" as type FROM users WHERE role = "teacher"',
        [],
        'railway'
      );
      const admins = await query(
        'SELECT id, name, email, "admin" as type FROM users WHERE role = "admin"',
        [],
        'railway'
      );
      contacts = [...teachers, ...admins];
    } else if (user_type === 'teacher') {
      // Teachers can message parents and admins
      const parents = await query(
        'SELECT id, name, email, "parent" as type FROM users WHERE role = "parent"',
        [],
        'skydek_DB'
      );
      const admins = await query(
        'SELECT id, name, email, "admin" as type FROM users WHERE role = "admin"',
        [],
        'railway'
      );
      contacts = [...parents, ...admins];
    } else if (user_type === 'admin') {
      // Admins can message everyone
      const teachers = await query(
        'SELECT id, name, email, "teacher" as type FROM users WHERE role = "teacher"',
        [],
        'railway'
      );
      const parents = await query(
        'SELECT id, name, email, "parent" as type FROM users WHERE role = "parent"',
        [],
        'skydek_DB'
      );
      contacts = [...teachers, ...parents];
    }

    res.json({ success: true, contacts });
  } catch (error) {
    logger.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Failed to fetch contacts' });
  }
};

// Helper function to create notifications
export const createNotification = async (notificationData) => {
  try {
    await execute(
      `INSERT INTO notifications (user_id, user_type, title, message, notification_type, priority, action_url, related_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        notificationData.user_id,
        notificationData.user_type,
        notificationData.title,
        notificationData.message,
        notificationData.notification_type,
        notificationData.priority,
        notificationData.action_url,
        notificationData.related_id
      ],
      'skydek_DB'
    );
  } catch (error) {
    logger.error('Error creating notification:', error);
  }
};

// Helper function to send push notifications
const sendMessageNotification = async (userId, userType, notificationData) => {
  try {
    // Get user's FCM token
    const tokenResult = await query(
      'SELECT token FROM fcm_tokens WHERE user_id = ? AND user_type = ? AND is_active = TRUE',
      [userId, userType],
      'skydek_DB'
    );

    if (tokenResult.length > 0) {
      for (const tokenRow of tokenResult) {
        await sendPushNotification(tokenRow.token, notificationData);
      }
    }
  } catch (error) {
    logger.error('Error sending push notification:', error);
  }
};

// Get notifications for user
export const getNotifications = async (req, res) => {
  const user_id = req.user.id;
  const user_type = req.user.role;
  const { page = 1, limit = 20, unread_only = false } = req.query;
  const offset = (page - 1) * limit;

  try {
    let whereClause = 'WHERE user_id = ? AND user_type = ?';
    let params = [user_id, user_type];

    if (unread_only === 'true') {
      whereClause += ' AND is_read = FALSE';
    }

    const notifications = await query(
      `SELECT * FROM notifications ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset],
      'skydek_DB'
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM notifications ${whereClause}`,
      params,
      'skydek_DB'
    );

    res.json({
      success: true,
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

// Mark notification as read
export const markNotificationAsRead = async (req, res) => {
  const { notificationId } = req.params;
  const user_id = req.user.id;
  const user_type = req.user.role;

  try {
    await execute(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ? AND user_type = ?',
      [notificationId, user_id, user_type],
      'skydek_DB'
    );

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
};

