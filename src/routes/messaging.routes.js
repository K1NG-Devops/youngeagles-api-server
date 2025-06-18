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
router.get('/conversation/:otherUserId/:otherUserType', authMiddleware, getConversation);
router.put('/:messageId/read', authMiddleware, markAsRead);
router.get('/unread-count', authMiddleware, getUnreadCount);
router.get('/contacts', authMiddleware, getContacts);

// Notification routes
router.get('/notifications', authMiddleware, getNotifications);
router.put('/notifications/:notificationId/read', authMiddleware, markNotificationAsRead);

export default router;

