import express from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  sendMessage,
  getMessages,
  getConversation,
  markAsRead,
  getUnreadCount,
  getContacts,
  getNotifications,
  markNotificationAsRead
} from '../controllers/messagingController.js';
import { query } from '../db.js';

const router = express.Router();

// Validation middleware
const validateMessage = [
  body('recipient_id').isInt().withMessage('Recipient ID must be a number'),
  body('recipient_type').isIn(['parent', 'teacher', 'admin']).withMessage('Invalid recipient type'),
  body('message').notEmpty().withMessage('Message cannot be empty'),
  body('subject').optional().isLength({ max: 255 }).withMessage('Subject too long'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Message routes
router.post('/send', authMiddleware, validateMessage, sendMessage);
router.get('/', authMiddleware, getMessages);
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.role;
    
    // Get all conversations for this user
    const conversations = await query(
      `SELECT DISTINCT
        CASE 
          WHEN sender_id = ? AND sender_type = ? THEN recipient_id
          ELSE sender_id
        END as other_user_id,
        CASE 
          WHEN sender_id = ? AND sender_type = ? THEN recipient_type
          ELSE sender_type
        END as other_user_type,
        MAX(created_at) as last_message_time,
        COUNT(*) as message_count,
        SUM(CASE WHEN recipient_id = ? AND recipient_type = ? AND is_read = FALSE THEN 1 ELSE 0 END) as unread_count
       FROM messages 
       WHERE (sender_id = ? AND sender_type = ?) OR (recipient_id = ? AND recipient_type = ?)
       GROUP BY other_user_id, other_user_type
       ORDER BY last_message_time DESC`,
      [userId, userType, userId, userType, userId, userType, userId, userType, userId, userType],
      'skydek_DB'
    );
    
    res.json({
      success: true,
      conversations: conversations || [],
      count: conversations ? conversations.length : 0
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching conversations',
      error: error.message 
    });
  }
});
router.get('/conversation/:otherUserId/:otherUserType', authMiddleware, getConversation);
router.put('/:messageId/read', authMiddleware, markAsRead);
router.get('/unread-count', authMiddleware, getUnreadCount);
router.get('/contacts', authMiddleware, getContacts);

// Notification routes
router.get('/notifications', authMiddleware, getNotifications);
router.put('/notifications/:notificationId/read', authMiddleware, markNotificationAsRead);

export default router;

