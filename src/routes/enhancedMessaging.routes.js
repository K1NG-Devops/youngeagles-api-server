import express from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { query, execute } from '../db.js';
import {
  sendEnhancedMessage,
  markMessageAsRead,
  addMessageReaction,
  removeMessageReaction,
  updateUserPresence,
  setTypingIndicator,
  searchMessages,
  getEnhancedConversations,
  getEnhancedMessages
} from '../controllers/enhancedMessagingController.js';

const router = express.Router();

// Enhanced message sending with validation
const validateEnhancedMessage = [
  body('recipient_id').isInt().withMessage('Recipient ID must be a number'),
  body('recipient_type').isIn(['parent', 'teacher', 'admin']).withMessage('Invalid recipient type'),
  body('message').notEmpty().withMessage('Message cannot be empty'),
  body('message_priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority'),
  body('reply_to_message_id').optional().isInt().withMessage('Reply to message ID must be a number'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Enhanced Routes

// Send enhanced message with read receipts and delivery tracking
router.post('/send-enhanced', authMiddleware, validateEnhancedMessage, sendEnhancedMessage);

// Mark message as read (generates read receipt)
router.patch('/messages/:messageId/read', authMiddleware, markMessageAsRead);

// Add reaction to message
router.post('/messages/:messageId/reactions', authMiddleware, [
  body('emoji').notEmpty().withMessage('Emoji is required')
], addMessageReaction);

// Remove reaction from message
router.delete('/messages/:messageId/reactions', authMiddleware, [
  body('emoji').notEmpty().withMessage('Emoji is required')
], removeMessageReaction);

// Update user presence status
router.post('/presence', authMiddleware, [
  body('status').isIn(['online', 'away', 'busy', 'offline']).withMessage('Invalid status')
], updateUserPresence);

// Set typing indicator
router.post('/typing', authMiddleware, [
  body('conversationId').notEmpty().withMessage('Conversation ID is required'),
  body('isTyping').isBoolean().withMessage('isTyping must be boolean')
], setTypingIndicator);

// Search messages with full-text search
router.get('/search', authMiddleware, searchMessages);

// Get enhanced conversations with presence and read status
router.get('/conversations-enhanced', authMiddleware, getEnhancedConversations);

// Get enhanced messages for a conversation
router.get('/conversations/:conversationId/messages-enhanced', authMiddleware, getEnhancedMessages);

// Get message reactions
router.get('/messages/:messageId/reactions', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const reactions = await query(
      `SELECT mr.*, 
              CASE 
                WHEN mr.user_type = 'parent' THEN (SELECT name FROM users WHERE id = mr.user_id)
                ELSE (SELECT name FROM staff WHERE id = mr.user_id)
              END as user_name
       FROM message_reactions mr
       WHERE message_id = ?
       ORDER BY created_at ASC`,
      [messageId],
      'skydek_DB'
    );

    // Group reactions by emoji
    const groupedReactions = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.reaction_emoji]) {
        acc[reaction.reaction_emoji] = [];
      }
      acc[reaction.reaction_emoji].push({
        userId: reaction.user_id,
        userType: reaction.user_type,
        userName: reaction.user_name,
        createdAt: reaction.created_at
      });
      return acc;
    }, {});

    res.json({
      success: true,
      reactions: groupedReactions,
      totalCount: reactions.length
    });
  } catch (error) {
    console.error('Error fetching message reactions:', error);
    res.status(500).json({ message: 'Failed to fetch reactions' });
  }
});

// Get user presence status
router.get('/presence/:userId/:userType', authMiddleware, async (req, res) => {
  try {
    const { userId, userType } = req.params;
    
    const [presence] = await query(
      'SELECT * FROM user_presence WHERE user_id = ? AND user_type = ?',
      [userId, userType],
      'skydek_DB'
    );

    res.json({
      success: true,
      presence: presence || {
        status: 'offline',
        lastSeen: null
      }
    });
  } catch (error) {
    console.error('Error fetching presence:', error);
    res.status(500).json({ message: 'Failed to fetch presence' });
  }
});

// Get typing indicators for conversation
router.get('/conversations/:conversationId/typing', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const typingUsers = await query(
      `SELECT ti.*, 
              CASE 
                WHEN ti.user_type = 'parent' THEN (SELECT name FROM users WHERE id = ti.user_id)
                ELSE (SELECT name FROM staff WHERE id = ti.user_id)
              END as user_name
       FROM typing_indicators ti
       WHERE conversation_id = ? AND expires_at > NOW()`,
      [conversationId],
      'skydek_DB'
    );

    res.json({
      success: true,
      typingUsers: typingUsers.map(user => ({
        userId: user.user_id,
        userType: user.user_type,
        userName: user.user_name,
        startedAt: user.started_at,
        expiresAt: user.expires_at
      }))
    });
  } catch (error) {
    console.error('Error fetching typing indicators:', error);
    res.status(500).json({ message: 'Failed to fetch typing indicators' });
  }
});

// Get notification preferences
router.get('/notification-preferences', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.role;
    
    const preferences = await query(
      'SELECT * FROM notification_preferences WHERE user_id = ? AND user_type = ?',
      [userId, userType],
      'skydek_DB'
    );

    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ message: 'Failed to fetch notification preferences' });
  }
});

// Update notification preferences
router.put('/notification-preferences', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.role;
    const { preferences } = req.body;

    // Update each preference
    for (const pref of preferences) {
      await execute(
        `INSERT INTO notification_preferences 
         (user_id, user_type, notification_type, enabled, sound_enabled, vibration_enabled, 
          quiet_hours_start, quiet_hours_end, weekend_notifications, priority_threshold)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         enabled = VALUES(enabled),
         sound_enabled = VALUES(sound_enabled),
         vibration_enabled = VALUES(vibration_enabled),
         quiet_hours_start = VALUES(quiet_hours_start),
         quiet_hours_end = VALUES(quiet_hours_end),
         weekend_notifications = VALUES(weekend_notifications),
         priority_threshold = VALUES(priority_threshold)`,
        [
          userId, userType, pref.notification_type, pref.enabled,
          pref.sound_enabled, pref.vibration_enabled, pref.quiet_hours_start,
          pref.quiet_hours_end, pref.weekend_notifications, pref.priority_threshold
        ],
        'skydek_DB'
      );
    }

    res.json({
      success: true,
      message: 'Notification preferences updated successfully'
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ message: 'Failed to update notification preferences' });
  }
});

// Get conversation settings
router.get('/conversations/:conversationId/settings', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;
    
    const [settings] = await query(
      'SELECT * FROM conversation_settings WHERE conversation_id = ? AND user_id = ? AND user_type = ?',
      [conversationId, userId, userType],
      'skydek_DB'
    );

    res.json({
      success: true,
      settings: settings || {
        is_muted: false,
        is_pinned: false,
        is_archived: false,
        read_receipts_enabled: true,
        typing_indicators_enabled: true,
        sound_notifications: true
      }
    });
  } catch (error) {
    console.error('Error fetching conversation settings:', error);
    res.status(500).json({ message: 'Failed to fetch conversation settings' });
  }
});

// Update conversation settings
router.put('/conversations/:conversationId/settings', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;
    const settings = req.body;

    await execute(
      `INSERT INTO conversation_settings 
       (conversation_id, user_id, user_type, is_muted, is_pinned, is_archived,
        read_receipts_enabled, typing_indicators_enabled, sound_notifications)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       is_muted = VALUES(is_muted),
       is_pinned = VALUES(is_pinned),
       is_archived = VALUES(is_archived),
       read_receipts_enabled = VALUES(read_receipts_enabled),
       typing_indicators_enabled = VALUES(typing_indicators_enabled),
       sound_notifications = VALUES(sound_notifications)`,
      [
        conversationId, userId, userType, settings.is_muted,
        settings.is_pinned, settings.is_archived, settings.read_receipts_enabled,
        settings.typing_indicators_enabled, settings.sound_notifications
      ],
      'skydek_DB'
    );

    res.json({
      success: true,
      message: 'Conversation settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating conversation settings:', error);
    res.status(500).json({ message: 'Failed to update conversation settings' });
  }
});

// Get message delivery status
router.get('/messages/:messageId/delivery-status', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const deliveryStatus = await query(
      'SELECT * FROM message_delivery WHERE message_id = ?',
      [messageId],
      'skydek_DB'
    );

    res.json({
      success: true,
      deliveryStatus
    });
  } catch (error) {
    console.error('Error fetching delivery status:', error);
    res.status(500).json({ message: 'Failed to fetch delivery status' });
  }
});

export default router; 