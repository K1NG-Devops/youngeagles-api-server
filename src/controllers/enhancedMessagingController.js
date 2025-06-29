import { query, execute } from '../db.js';
import { sendPushNotification } from '../utils/pushNotifications.js';
import logger from '../utils/logger.js';

// Enhanced message sending with read receipts and delivery tracking
export const sendEnhancedMessage = async (req, res) => {
  const { 
    recipient_id, 
    recipient_type, 
    subject, 
    message, 
    message_type = 'text',
    message_priority = 'normal',
    reply_to_message_id = null,
    attachment_type = null,
    attachment_size = null,
    voice_duration = null
  } = req.body;
  
  const sender_id = req.user.id;
  const sender_type = req.user.role;

  try {
    // Insert the enhanced message
    const result = await execute(
      `INSERT INTO messages (
        sender_id, sender_type, recipient_id, recipient_type, 
        subject, message, message_type, message_priority,
        reply_to_message_id, attachment_type, attachment_size, 
        voice_duration, message_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', NOW())`,
      [
        sender_id, sender_type, recipient_id, recipient_type,
        subject, message, message_type, message_priority,
        reply_to_message_id, attachment_type, attachment_size, voice_duration
      ],
      'skydek_DB'
    );

    const messageId = result.insertId;

    // Create delivery tracking record
    await execute(
      `INSERT INTO message_delivery (message_id, user_id, user_type, delivery_status, created_at)
       VALUES (?, ?, ?, 'sent', NOW())`,
      [messageId, recipient_id, recipient_type],
      'skydek_DB'
    );

    // Update message status to delivered if recipient is online
    const [recipientPresence] = await query(
      'SELECT status FROM user_presence WHERE user_id = ? AND user_type = ?',
      [recipient_id, recipient_type],
      'skydek_DB'
    );

    if (recipientPresence && recipientPresence.status === 'online') {
      await execute(
        `UPDATE messages SET message_status = 'delivered', delivered_at = NOW() WHERE id = ?`,
        [messageId],
        'skydek_DB'
      );
      
      await execute(
        `UPDATE message_delivery SET delivery_status = 'delivered', delivered_at = NOW() WHERE message_id = ?`,
        [messageId],
        'skydek_DB'
      );
    }

    // Send enhanced push notification with priority handling
    const notificationPriority = message_priority === 'urgent' ? 'high' : 'normal';
    await sendEnhancedNotification(recipient_id, recipient_type, {
      title: `${message_priority === 'urgent' ? '🚨 URGENT: ' : ''}New message from ${req.user.name}`,
      body: subject || message.substring(0, 100),
      priority: notificationPriority,
      data: { 
        messageId, 
        type: 'message',
        senderId: sender_id,
        senderType: sender_type,
        priority: message_priority
      }
    });

    logger.info(`Enhanced message sent: ${messageId} from ${sender_id}(${sender_type}) to ${recipient_id}(${recipient_type})`);

    res.status(201).json({
      success: true,
      message: 'Enhanced message sent successfully',
      messageId,
      status: recipientPresence?.status === 'online' ? 'delivered' : 'sent'
    });
  } catch (error) {
    logger.error('Error sending enhanced message:', error);
    res.status(500).json({ message: 'Failed to send enhanced message' });
  }
};

// Mark message as read with read receipt
export const markMessageAsRead = async (req, res) => {
  const { messageId } = req.params;
  const user_id = req.user.id;
  const user_type = req.user.role;

  try {
    // Update message status
    await execute(
      `UPDATE messages SET message_status = 'read', read_at = NOW() 
       WHERE id = ? AND recipient_id = ? AND recipient_type = ?`,
      [messageId, user_id, user_type],
      'skydek_DB'
    );

    // Update delivery tracking
    await execute(
      `UPDATE message_delivery SET delivery_status = 'read', read_at = NOW() 
       WHERE message_id = ? AND user_id = ? AND user_type = ?`,
      [messageId, user_id, user_type],
      'skydek_DB'
    );

    // Get message details for read receipt notification
    const [message] = await query(
      'SELECT sender_id, sender_type FROM messages WHERE id = ?',
      [messageId],
      'skydek_DB'
    );

    if (message) {
      // Send read receipt to sender via WebSocket
      req.io?.to(`user_${message.sender_type}_${message.sender_id}`).emit('messageRead', {
        messageId,
        readBy: user_id,
        readByType: user_type,
        readAt: new Date().toISOString()
      });
    }

    res.json({ 
      success: true, 
      message: 'Message marked as read',
      readAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error marking message as read:', error);
    res.status(500).json({ message: 'Failed to mark message as read' });
  }
};

// Add reaction to message
export const addMessageReaction = async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const user_id = req.user.id;
  const user_type = req.user.role;

  try {
    // Add or update reaction
    await execute(
      `INSERT INTO message_reactions (message_id, user_id, user_type, reaction_emoji)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE reaction_emoji = VALUES(reaction_emoji), created_at = NOW()`,
      [messageId, user_id, user_type, emoji],
      'skydek_DB'
    );

    // Get updated reaction count
    const [reactionCount] = await query(
      'SELECT COUNT(*) as count FROM message_reactions WHERE message_id = ?',
      [messageId],
      'skydek_DB'
    );

    // Notify other participants via WebSocket
    const [message] = await query(
      'SELECT sender_id, sender_type, recipient_id, recipient_type FROM messages WHERE id = ?',
      [messageId],
      'skydek_DB'
    );

    if (message) {
      const participants = [
        `user_${message.sender_type}_${message.sender_id}`,
        `user_${message.recipient_type}_${message.recipient_id}`
      ];

      participants.forEach(participant => {
        req.io?.to(participant).emit('messageReaction', {
          messageId,
          emoji,
          userId: user_id,
          userType: user_type,
          userName: req.user.name,
          totalReactions: reactionCount.count
        });
      });
    }

    res.json({
      success: true,
      message: 'Reaction added successfully',
      totalReactions: reactionCount.count
    });
  } catch (error) {
    logger.error('Error adding message reaction:', error);
    res.status(500).json({ message: 'Failed to add reaction' });
  }
};

// Remove reaction from message
export const removeMessageReaction = async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const user_id = req.user.id;
  const user_type = req.user.role;

  try {
    await execute(
      `DELETE FROM message_reactions 
       WHERE message_id = ? AND user_id = ? AND user_type = ? AND reaction_emoji = ?`,
      [messageId, user_id, user_type, emoji],
      'skydek_DB'
    );

    res.json({ success: true, message: 'Reaction removed successfully' });
  } catch (error) {
    logger.error('Error removing message reaction:', error);
    res.status(500).json({ message: 'Failed to remove reaction' });
  }
};

// Update user presence status
export const updateUserPresence = async (req, res) => {
  const { status, deviceInfo } = req.body;
  const user_id = req.user.id;
  const user_type = req.user.role;

  try {
    await execute(
      `INSERT INTO user_presence (user_id, user_type, status, device_info, last_seen, socket_id)
       VALUES (?, ?, ?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE 
       status = VALUES(status), 
       device_info = VALUES(device_info), 
       last_seen = NOW(),
       socket_id = VALUES(socket_id)`,
      [user_id, user_type, status, deviceInfo, req.socketId || null],
      'skydek_DB'
    );

    // Broadcast presence update to all contacts
    const contacts = await getContactsForPresence(user_id, user_type);
    contacts.forEach(contact => {
      req.io?.to(`user_${contact.type}_${contact.id}`).emit('presenceUpdate', {
        userId: user_id,
        userType: user_type,
        userName: req.user.name,
        status,
        lastSeen: new Date().toISOString()
      });
    });

    res.json({ success: true, message: 'Presence updated successfully' });
  } catch (error) {
    logger.error('Error updating user presence:', error);
    res.status(500).json({ message: 'Failed to update presence' });
  }
};

// Set typing indicator
export const setTypingIndicator = async (req, res) => {
  const { conversationId, isTyping } = req.body;
  const user_id = req.user.id;
  const user_type = req.user.role;

  try {
    if (isTyping) {
      // Set typing indicator with expiration
      const expiresAt = new Date(Date.now() + 10000); // 10 seconds
      await execute(
        `INSERT INTO typing_indicators (conversation_id, user_id, user_type, is_typing, expires_at)
         VALUES (?, ?, ?, TRUE, ?)
         ON DUPLICATE KEY UPDATE is_typing = TRUE, started_at = NOW(), expires_at = VALUES(expires_at)`,
        [conversationId, user_id, user_type, expiresAt],
        'skydek_DB'
      );
    } else {
      // Remove typing indicator
      await execute(
        `DELETE FROM typing_indicators 
         WHERE conversation_id = ? AND user_id = ? AND user_type = ?`,
        [conversationId, user_id, user_type],
        'skydek_DB'
      );
    }

    // Broadcast typing status to conversation participants
    req.io?.to(`conversation_${conversationId}`).emit('typingIndicator', {
      conversationId,
      userId: user_id,
      userType: user_type,
      userName: req.user.name,
      isTyping
    });

    res.json({ success: true, message: 'Typing indicator updated' });
  } catch (error) {
    logger.error('Error setting typing indicator:', error);
    res.status(500).json({ message: 'Failed to set typing indicator' });
  }
};

// Search messages
export const searchMessages = async (req, res) => {
  const { q: searchQuery, limit = 20, offset = 0 } = req.query;
  const user_id = req.user.id;
  const user_type = req.user.role;

  try {
    if (!searchQuery) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Full-text search with relevance scoring
    const messages = await query(
      `SELECT m.*, msi.search_text,
              MATCH(msi.search_text) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance,
              CASE 
                WHEN m.sender_type = 'parent' THEN (SELECT name FROM users WHERE id = m.sender_id)
                ELSE (SELECT name FROM staff WHERE id = m.sender_id)
              END as sender_name,
              CASE 
                WHEN m.recipient_type = 'parent' THEN (SELECT name FROM users WHERE id = m.recipient_id)
                ELSE (SELECT name FROM staff WHERE id = m.recipient_id)
              END as recipient_name
       FROM messages m
       INNER JOIN message_search_index msi ON m.id = msi.message_id
       WHERE ((m.sender_id = ? AND m.sender_type = ?) OR (m.recipient_id = ? AND m.recipient_type = ?))
       AND MATCH(msi.search_text) AGAINST(? IN NATURAL LANGUAGE MODE)
       ORDER BY relevance DESC, m.created_at DESC
       LIMIT ? OFFSET ?`,
      [searchQuery, user_id, user_type, user_id, user_type, searchQuery, parseInt(limit), parseInt(offset)],
      'skydek_DB'
    );

    // Get total count for pagination
    const [countResult] = await query(
      `SELECT COUNT(*) as total
       FROM messages m
       INNER JOIN message_search_index msi ON m.id = msi.message_id
       WHERE ((m.sender_id = ? AND m.sender_type = ?) OR (m.recipient_id = ? AND m.recipient_type = ?))
       AND MATCH(msi.search_text) AGAINST(? IN NATURAL LANGUAGE MODE)`,
      [user_id, user_type, user_id, user_type, searchQuery],
      'skydek_DB'
    );

    res.json({
      success: true,
      messages,
      pagination: {
        total: countResult.total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < countResult.total
      },
      searchQuery
    });
  } catch (error) {
    logger.error('Error searching messages:', error);
    res.status(500).json({ message: 'Failed to search messages' });
  }
};

// Get enhanced conversations with presence and read status
export const getEnhancedConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.role;
    
    console.log(`📥 Getting enhanced conversations for user ${userId} (${userType})`);
    
    // Get conversations with enhanced data
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
        SUM(CASE WHEN is_read = FALSE AND recipient_id = ? AND recipient_type = ? THEN 1 ELSE 0 END) as unread_count,
        MAX(CASE WHEN message_priority = 'urgent' THEN 1 ELSE 0 END) as has_urgent_messages
      FROM messages 
      WHERE (sender_id = ? AND sender_type = ?) 
         OR (recipient_id = ? AND recipient_type = ?)
      GROUP BY other_user_id, other_user_type
      ORDER BY has_urgent_messages DESC, last_message_time DESC`,
      [userId, userType, userId, userType, userId, userType, userId, userType, userId, userType],
      'skydek_DB'
    );

    // Enhance conversations with presence, names, and additional data
    const enhancedConversations = await Promise.all(conversations.map(async (conv) => {
      let name = 'Unknown User';
      let presenceStatus = 'offline';
      let lastSeen = null;

      try {
        // Get user name and presence
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

        // Get presence status
        const [presence] = await query(
          'SELECT status, last_seen FROM user_presence WHERE user_id = ? AND user_type = ?',
          [conv.other_user_id, conv.other_user_type],
          'skydek_DB'
        );
        
        if (presence) {
          presenceStatus = presence.status;
          lastSeen = presence.last_seen;
        }
      } catch (error) {
        console.error('Error getting enhanced conversation data:', error);
      }

      // Get last message with reactions
      const [lastMessage] = await query(
        `SELECT m.*, 
                (SELECT COUNT(*) FROM message_reactions WHERE message_id = m.id) as reaction_count,
                (SELECT GROUP_CONCAT(DISTINCT reaction_emoji) FROM message_reactions WHERE message_id = m.id) as reactions
         FROM messages m
         WHERE ((sender_id = ? AND sender_type = ? AND recipient_id = ? AND recipient_type = ?)
            OR (sender_id = ? AND sender_type = ? AND recipient_id = ? AND recipient_type = ?))
         ORDER BY created_at DESC LIMIT 1`,
        [userId, userType, conv.other_user_id, conv.other_user_type,
         conv.other_user_id, conv.other_user_type, userId, userType],
        'skydek_DB'
      );

      // Get typing indicator
      const [typingIndicator] = await query(
        'SELECT * FROM typing_indicators WHERE conversation_id = ? AND user_id = ? AND user_type = ? AND expires_at > NOW()',
        [`${conv.other_user_id}_${conv.other_user_type}`, conv.other_user_id, conv.other_user_type],
        'skydek_DB'
      );

      const conversationId = `${conv.other_user_id}_${conv.other_user_type}`;
      
      return {
        id: conversationId,
        otherParticipant: {
          id: conv.other_user_id,
          name: name,
          type: conv.other_user_type,
          presenceStatus,
          lastSeen,
          isTyping: !!typingIndicator
        },
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          content: lastMessage.message,
          senderId: lastMessage.sender_id,
          senderType: lastMessage.sender_type,
          createdAt: lastMessage.created_at,
          messageStatus: lastMessage.message_status,
          readAt: lastMessage.read_at,
          priority: lastMessage.message_priority,
          reactionCount: parseInt(lastMessage.reaction_count) || 0,
          reactions: lastMessage.reactions ? lastMessage.reactions.split(',') : []
        } : null,
        unreadCount: parseInt(conv.unread_count) || 0,
        messageCount: parseInt(conv.message_count) || 0,
        lastMessageTime: conv.last_message_time,
        hasUrgentMessages: !!conv.has_urgent_messages
      };
    }));
    
    console.log(`✅ Found ${enhancedConversations.length} enhanced conversations`);
    
    res.json({
      success: true,
      conversations: enhancedConversations,
      count: enhancedConversations.length
    });
  } catch (error) {
    console.error('❌ Error fetching enhanced conversations:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching enhanced conversations',
      error: error.message 
    });
  }
};

// Get enhanced messages for a conversation
export const getEnhancedMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    console.log(`💬 Getting enhanced messages for conversation: ${conversationId}`);
    
    // Parse conversation ID
    const [otherUserId, otherUserType] = conversationId.split('_');
    
    if (!otherUserId || !otherUserType) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format'
      });
    }
    
    // Get enhanced messages with reactions and read status
    const messages = await query(
      `SELECT m.*,
              CASE 
                WHEN m.sender_type = 'parent' THEN (SELECT name FROM users WHERE id = m.sender_id)
                ELSE (SELECT name FROM staff WHERE id = m.sender_id)
              END as sender_name,
              (SELECT COUNT(*) FROM message_reactions WHERE message_id = m.id) as reaction_count,
              (SELECT JSON_ARRAYAGG(
                JSON_OBJECT('emoji', reaction_emoji, 'userId', user_id, 'userType', user_type)
              ) FROM message_reactions WHERE message_id = m.id) as reactions,
              (SELECT message FROM messages WHERE id = m.reply_to_message_id) as reply_to_content
       FROM messages m
       WHERE ((sender_id = ? AND sender_type = ? AND recipient_id = ? AND recipient_type = ?)
          OR (sender_id = ? AND sender_type = ? AND recipient_id = ? AND recipient_type = ?))
       ORDER BY created_at ASC
       LIMIT ? OFFSET ?`,
      [userId, userType, parseInt(otherUserId), otherUserType,
       parseInt(otherUserId), otherUserType, userId, userType,
       parseInt(limit), offset],
      'skydek_DB'
    );

    // Mark messages as read
    await execute(
      `UPDATE messages 
       SET message_status = 'read', read_at = NOW() 
       WHERE recipient_id = ? AND recipient_type = ? 
       AND sender_id = ? AND sender_type = ? 
       AND message_status != 'read'`,
      [userId, userType, parseInt(otherUserId), otherUserType],
      'skydek_DB'
    );

    // Update delivery tracking
    await execute(
      `UPDATE message_delivery 
       SET delivery_status = 'read', read_at = NOW() 
       WHERE user_id = ? AND user_type = ? 
       AND message_id IN (
         SELECT id FROM messages 
         WHERE sender_id = ? AND sender_type = ? 
         AND recipient_id = ? AND recipient_type = ?
       )`,
      [userId, userType, parseInt(otherUserId), otherUserType, userId, userType],
      'skydek_DB'
    );

    // Send read receipts via WebSocket
    req.io?.to(`user_${otherUserType}_${otherUserId}`).emit('messagesRead', {
      conversationId,
      readBy: userId,
      readByType: userType,
      readAt: new Date().toISOString()
    });

    console.log(`📊 Found ${messages.length} enhanced messages in conversation`);

    res.json({ 
      success: true, 
      messages: messages.map(msg => ({
        ...msg,
        reactions: msg.reactions ? JSON.parse(msg.reactions) : []
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        offset
      }
    });
  } catch (error) {
    console.error('❌ Error fetching enhanced messages:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch enhanced messages' 
    });
  }
};

// Helper function to get contacts for presence updates
async function getContactsForPresence(userId, userType) {
  try {
    let contacts = [];

    if (userType === 'parent') {
      // Get teachers and admins the parent has messaged
      const results = await query(
        `SELECT DISTINCT recipient_id as id, recipient_type as type
         FROM messages WHERE sender_id = ? AND sender_type = ?
         UNION
         SELECT DISTINCT sender_id as id, sender_type as type
         FROM messages WHERE recipient_id = ? AND recipient_type = ?`,
        [userId, userType, userId, userType],
        'skydek_DB'
      );
      contacts = results;
    } else if (userType === 'teacher' || userType === 'admin') {
      // Get parents and other staff the user has messaged
      const results = await query(
        `SELECT DISTINCT recipient_id as id, recipient_type as type
         FROM messages WHERE sender_id = ? AND sender_type = ?
         UNION
         SELECT DISTINCT sender_id as id, sender_type as type
         FROM messages WHERE recipient_id = ? AND recipient_type = ?`,
        [userId, userType, userId, userType],
        'skydek_DB'
      );
      contacts = results;
    }

    return contacts;
  } catch (error) {
    logger.error('Error getting contacts for presence:', error);
    return [];
  }
}

// Enhanced notification sending
async function sendEnhancedNotification(userId, userType, notificationData) {
  try {
    // Check user notification preferences
    const [preferences] = await query(
      `SELECT * FROM notification_preferences 
       WHERE user_id = ? AND user_type = ? AND notification_type = 'message'`,
      [userId, userType],
      'skydek_DB'
    );

    if (preferences && !preferences.enabled) {
      return; // User has disabled message notifications
    }

    // Check quiet hours
    if (preferences?.quiet_hours_start && preferences?.quiet_hours_end) {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      
      if (currentTime >= preferences.quiet_hours_start && currentTime <= preferences.quiet_hours_end) {
        return; // Within quiet hours
      }
    }

    // Send the notification
    await sendPushNotification(userId, userType, notificationData);
  } catch (error) {
    logger.error('Error sending enhanced notification:', error);
  }
}

export {
  sendEnhancedNotification
}; 