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
import { query, execute } from '../db.js';

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
router.post('/send', authMiddleware, async (req, res) => {
  try {
    console.log('📨 Message send request received:', {
      body: req.body,
      user: req.user,
      headers: req.headers,
      method: req.method,
      url: req.url
    });

    let { recipient_id, recipient_type, message, subject } = req.body;

    // Smart auto-fix: Assign appropriate recipient based on sender role
    if (!recipient_id || !recipient_type) {
      console.log('🔧 Auto-fixing: No recipient specified, determining appropriate recipient...');
      
      const senderRole = req.user.role;
      const senderId = req.user.id;
      
      if (senderRole === 'parent') {
        // Parents should message their child's teacher by default
        console.log('👨‍👩‍👧‍👦 Parent sender detected, finding child\'s teacher...');
        
        const [childTeacher] = await query(
          `SELECT DISTINCT s.id, s.name 
           FROM staff s 
           INNER JOIN children c ON s.id = c.teacher_id 
           WHERE c.parent_id = ? AND s.role = 'teacher'
           ORDER BY s.id ASC LIMIT 1`,
          [senderId],
          'skydek_DB'
        );
        
        if (childTeacher) {
          recipient_id = childTeacher.id;
          recipient_type = 'teacher';
          console.log(`✅ Auto-assigned to child's teacher: ${childTeacher.name} (ID: ${childTeacher.id})`);
        } else {
          // Fallback to admin if no teacher found
          const [admin] = await query(
            'SELECT id FROM staff WHERE role = ? ORDER BY id ASC LIMIT 1',
            ['admin'],
            'skydek_DB'
          );
          
          if (admin) {
            recipient_id = admin.id;
            recipient_type = 'admin';
            console.log(`🔄 No teacher found, auto-assigned to admin: ${admin.id}`);
          }
        }
        
      } else if (senderRole === 'teacher') {
        // Teachers should message admin by default
        console.log('👨‍🏫 Teacher sender detected, finding admin...');
        
        const [admin] = await query(
          'SELECT id FROM staff WHERE role = ? ORDER BY id ASC LIMIT 1',
          ['admin'],
          'skydek_DB'
        );
        
        if (admin) {
          recipient_id = admin.id;
          recipient_type = 'admin';
          console.log(`✅ Auto-assigned to admin: ${admin.id}`);
        }
        
      } else {
        // Admin can message anyone, default to first available teacher
        console.log('👨‍💼 Admin sender detected, finding first teacher...');
        
        const [teacher] = await query(
          'SELECT id FROM staff WHERE role = ? ORDER BY id ASC LIMIT 1',
          ['teacher'],
          'skydek_DB'
        );
        
        if (teacher) {
          recipient_id = teacher.id;
          recipient_type = 'teacher';
          console.log(`✅ Auto-assigned to teacher: ${teacher.id}`);
        }
      }
      
      // Final fallback to admin if nothing else worked
      if (!recipient_id) {
        const [admin] = await query(
          'SELECT id FROM staff WHERE role = ? ORDER BY id ASC LIMIT 1',
          ['admin'],
          'skydek_DB'
        );
        
        if (admin) {
          recipient_id = admin.id;
          recipient_type = 'admin';
          console.log(`🆘 Final fallback to admin: ${admin.id}`);
        } else {
          return res.status(400).json({
            success: false,
            message: 'No valid recipient found for auto-assignment',
            error: 'NO_RECIPIENT_FOUND'
          });
        }
      }
    }

    // Basic validation with detailed logging
    const validationErrors = [];
    if (!recipient_id) validationErrors.push('recipient_id is missing');
    if (!message) validationErrors.push('message is missing');

    if (validationErrors.length > 0) {
      console.log('❌ Validation failed:', {
        errors: validationErrors,
        receivedBody: req.body
      });
      return res.status(400).json({
        success: false,
        message: 'Message content is required',
        errors: validationErrors,
        received: req.body
      });
    }

    // Verify recipient exists
    let recipientExists = false;
    if (recipient_type === 'parent') {
      const [parent] = await query(
        'SELECT id FROM users WHERE id = ? AND role = ?',
        [recipient_id, 'parent'],
        'skydek_DB'
      );
      recipientExists = !!parent;
    } else if (recipient_type === 'teacher' || recipient_type === 'admin') {
      const [staff] = await query(
        'SELECT id FROM staff WHERE id = ? AND role = ?',
        [recipient_id, recipient_type],
        'skydek_DB'
      );
      recipientExists = !!staff;
    }

    if (!recipientExists) {
      console.log('❌ Recipient not found:', {
        recipient_id,
        recipient_type
      });
      return res.status(404).json({
        success: false,
        message: 'Recipient not found',
        received: { recipient_id, recipient_type }
      });
    }

    // Insert the message
    const result = await execute(
      `INSERT INTO messages (
        sender_id, 
        sender_type, 
        recipient_id, 
        recipient_type, 
        message, 
        subject,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        req.user.role,
        recipient_id,
        recipient_type || 'parent', // Default to parent if not specified
        message,
        subject || ''
      ],
      'skydek_DB'
    );

    console.log('✅ Message sent successfully:', {
      messageId: result.insertId,
      sender: `${req.user.id} (${req.user.role})`,
      recipient: `${recipient_id} (${recipient_type || 'parent'})`,
      messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : '')
    });

    res.json({
      success: true,
      messageId: result.insertId,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});
router.get('/', authMiddleware, getMessages);

// Get all conversations for the user
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.role;
    
    console.log(`📥 Getting conversations for user ${userId} (${userType})`);
    
    // Get all unique conversations (both sent and received)
    const conversations = await query(
      `SELECT 
        DISTINCT 
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
        SUM(CASE WHEN is_read = FALSE AND recipient_id = ? AND recipient_type = ? THEN 1 ELSE 0 END) as unread_count
      FROM messages 
      WHERE (sender_id = ? AND sender_type = ?) 
         OR (recipient_id = ? AND recipient_type = ?)
      GROUP BY other_user_id, other_user_type
      ORDER BY last_message_time DESC`,
      [userId, userType, userId, userType, userId, userType, userId, userType, userId, userType],
      'skydek_DB'
    );

    // Get names for all participants
    const conversationsWithNames = await Promise.all(conversations.map(async (conv) => {
      let name = 'Unknown User';
      try {
        if (conv.other_user_type === 'parent') {
          const [user] = await query(
            'SELECT name FROM users WHERE id = ? AND role = ?',
            [conv.other_user_id, 'parent'],
            'skydek_DB'
          );
          name = user?.name || 'Unknown Parent';
        } else if (conv.other_user_type === 'teacher' || conv.other_user_type === 'admin') {
          const [staff] = await query(
            'SELECT name FROM staff WHERE id = ? AND role = ?',
            [conv.other_user_id, conv.other_user_type],
            'skydek_DB'
          );
          name = staff?.name || `Unknown ${conv.other_user_type}`;
        }
      } catch (error) {
        console.error('Error getting participant name:', error);
      }

      // Get last message
      const [lastMessage] = await query(
        `SELECT * FROM messages 
         WHERE ((sender_id = ? AND sender_type = ? AND recipient_id = ? AND recipient_type = ?)
            OR (sender_id = ? AND sender_type = ? AND recipient_id = ? AND recipient_type = ?))
         ORDER BY created_at DESC LIMIT 1`,
        [userId, userType, conv.other_user_id, conv.other_user_type,
         conv.other_user_id, conv.other_user_type, userId, userType],
        'skydek_DB'
      );

      const conversationId = `${conv.other_user_id}_${conv.other_user_type}`;
      console.log(`📝 Conversation: ${conversationId} with ${name} (${conv.message_count} messages)`);
      
      return {
        id: conversationId,
        otherParticipant: {
          id: conv.other_user_id,
          name: name,
          type: conv.other_user_type
        },
        lastMessage: lastMessage ? {
          content: lastMessage.message,
          senderId: lastMessage.sender_id,
          senderType: lastMessage.sender_type,
          createdAt: lastMessage.created_at
        } : null,
        unreadCount: parseInt(conv.unread_count) || 0,
        messageCount: parseInt(conv.message_count) || 0,
        lastMessageTime: conv.last_message_time
      };
    }));
    
    console.log(`✅ Found ${conversationsWithNames.length} conversations`);
    
    res.json({
      success: true,
      conversations: conversationsWithNames,
      count: conversationsWithNames.length
    });
  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching conversations',
      error: error.message 
    });
  }
});

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;
    
    console.log(`💬 Getting messages for conversation: ${conversationId}`);
    console.log(`👤 User: ${userId} (${userType})`);
    
    // Parse conversation ID (format: "otherUserId_otherUserType")
    let [otherUserId, otherUserType] = conversationId.split('_');
    
    if (!otherUserId || !otherUserType) {
      // Handle legacy numeric conversation IDs - try to infer the participant type
      if (!isNaN(conversationId)) {
        console.log(`🔧 Legacy numeric conversation ID detected: ${conversationId}, attempting to resolve...`);
        
        // Try to find this conversation in the messages table to determine the other participant
        const legacyMessages = await query(
          `SELECT DISTINCT 
            CASE WHEN sender_id = ? AND sender_type = ? THEN recipient_id ELSE sender_id END as other_user_id,
            CASE WHEN sender_id = ? AND sender_type = ? THEN recipient_type ELSE sender_type END as other_user_type
           FROM messages 
           WHERE id = ? OR (sender_id = ? OR recipient_id = ?)
           LIMIT 1`,
          [userId, userType, userId, userType, conversationId, conversationId, conversationId],
          'skydek_DB'
        );
        
        if (legacyMessages.length > 0) {
          const resolvedUserId = legacyMessages[0].other_user_id;
          const resolvedUserType = legacyMessages[0].other_user_type;
          console.log(`✅ Resolved legacy ID ${conversationId} to ${resolvedUserId}_${resolvedUserType}`);
          
          // Continue with resolved IDs
          otherUserId = resolvedUserId;
          otherUserType = resolvedUserType;
        } else {
          console.log('❌ Could not resolve legacy conversation ID:', conversationId);
          return res.status(400).json({
            success: false,
            message: 'Invalid conversation ID format - could not resolve legacy ID'
          });
        }
      } else {
        console.log('❌ Invalid conversation ID format:', conversationId);
        return res.status(400).json({
          success: false,
          message: 'Invalid conversation ID format'
        });
      }
    }
    
    console.log(`🔍 Looking for messages between ${userId}(${userType}) and ${otherUserId}(${otherUserType})`);
    
    // Get messages between these two users
    const messages = await query(
      `SELECT * FROM messages 
       WHERE ((sender_id = ? AND sender_type = ? AND recipient_id = ? AND recipient_type = ?)
          OR (sender_id = ? AND sender_type = ? AND recipient_id = ? AND recipient_type = ?))
       ORDER BY created_at ASC`,
      [userId, userType, otherUserId, otherUserType,
       otherUserId, otherUserType, userId, userType],
      'skydek_DB'
    );

    console.log(`📊 Found ${messages.length} messages in conversation`);

    // Mark messages as read
    await execute(
      `UPDATE messages SET is_read = TRUE 
       WHERE recipient_id = ? AND recipient_type = ? AND sender_id = ? AND sender_type = ?`,
      [userId, userType, otherUserId, otherUserType],
      'skydek_DB'
    );

    // Format messages for frontend
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      content: msg.message,
      senderId: msg.sender_id,
      senderType: msg.sender_type,
      createdAt: msg.created_at,
      isRead: msg.is_read
    }));

    res.json({
      success: true,
      messages: formattedMessages,
      count: formattedMessages.length
    });
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

// Send message to a specific conversation
router.post('/conversations/:conversationId/messages', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, messageType = 'text', attachmentUrl } = req.body;
    const userId = req.user.id;
    const userType = req.user.role;
    
    // Parse conversation ID (format: "otherUserId_otherUserType")
    const [otherUserId, otherUserType] = conversationId.split('_');
    
    if (!otherUserId || !otherUserType) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }
    
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }
    
    console.log(`📤 Sending message from ${userId} (${userType}) to ${otherUserId} (${otherUserType})`);
    
    // Insert the message
    const result = await execute(
      `INSERT INTO messages (sender_id, sender_type, recipient_id, recipient_type, message, message_type, subject) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, userType, otherUserId, otherUserType, content.trim(), messageType, ''],
      'skydek_DB'
    );
    
    const messageId = result.insertId;
    
    console.log(`✅ Message sent successfully with ID ${messageId}`);
    
    res.json({
      success: true,
      messageId: messageId,
      message: 'Message sent successfully'
    });
    
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
});

// Start a new conversation
router.post('/conversations', authMiddleware, async (req, res) => {
  try {
    const { recipientId, recipientType, subject, messageContent } = req.body;
    const userId = req.user.id;
    const userType = req.user.role;
    
    if (!recipientId || !recipientType || !messageContent) {
      return res.status(400).json({
        success: false,
        message: 'Recipient ID, type, and message content are required'
      });
    }
    
    console.log(`🆕 Starting conversation from ${userId} (${userType}) to ${recipientId} (${recipientType})`);
    
    // Send the initial message
    const result = await execute(
      `INSERT INTO messages (sender_id, sender_type, recipient_id, recipient_type, message, message_type, subject) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, userType, recipientId, recipientType, messageContent, 'text', subject || ''],
      'skydek_DB'
    );
    
    const messageId = result.insertId;
    const conversationId = `${recipientId}_${recipientType}`;
    
    console.log(`✅ Conversation started with ID ${conversationId}`);
    
    res.json({
      success: true,
      conversationId: conversationId,
      messageId: messageId,
      message: 'Conversation started successfully'
    });
    
  } catch (error) {
    console.error('❌ Error starting conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting conversation',
      error: error.message
    });
  }
});

// Mark conversation as read
router.patch('/conversations/:conversationId/read', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;
    
    // Parse conversation ID (format: "otherUserId_otherUserType")
    const [otherUserId, otherUserType] = conversationId.split('_');
    
    if (!otherUserId || !otherUserType) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }
    
    console.log(`📖 Marking conversation ${conversationId} as read for user ${userId}`);
    
    // Mark all messages from the other user as read
    await execute(
      `UPDATE messages SET is_read = TRUE 
       WHERE recipient_id = ? AND recipient_type = ? AND sender_id = ? AND sender_type = ?`,
      [userId, userType, otherUserId, otherUserType],
      'skydek_DB'
    );
    
    res.json({
      success: true,
      message: 'Conversation marked as read'
    });
    
  } catch (error) {
    console.error('❌ Error marking conversation as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking conversation as read',
      error: error.message
    });
  }
});

// Legacy routes (keep for backward compatibility)
router.get('/conversation/:otherUserId/:otherUserType', authMiddleware, getConversation);
router.put('/:messageId/read', authMiddleware, markAsRead);
router.get('/unread-count', authMiddleware, getUnreadCount);
router.get('/contacts', authMiddleware, getContacts);

// Notification routes
router.get('/notifications', authMiddleware, getNotifications);
router.put('/notifications/:notificationId/read', authMiddleware, markNotificationAsRead);

export default router;

