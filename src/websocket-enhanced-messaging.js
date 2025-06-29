import { query, execute } from './db.js';
import logger from './utils/logger.js';

export function setupEnhancedMessagingWebSocket(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Enhanced messaging WebSocket connected: ${socket.id}`);

    // User authentication and presence setup
    socket.on('authenticate', async (data) => {
      try {
        const { userId, userType, token } = data;
        
        // Verify token (you might want to add proper JWT verification here)
        if (!userId || !userType) {
          socket.emit('authError', { message: 'Invalid authentication data' });
          return;
        }

        // Store user info in socket
        socket.userId = userId;
        socket.userType = userType;
        socket.userRoom = `user_${userType}_${userId}`;

        // Join user's personal room
        socket.join(socket.userRoom);

        // Update user presence to online
        await execute(
          `INSERT INTO user_presence (user_id, user_type, status, socket_id, last_seen)
           VALUES (?, ?, 'online', ?, NOW())
           ON DUPLICATE KEY UPDATE 
           status = 'online', 
           socket_id = ?, 
           last_seen = NOW()`,
          [userId, userType, socket.id, socket.id],
          'skydek_DB'
        );

        // Get user's conversations to join conversation rooms
        const conversations = await query(
          `SELECT DISTINCT 
            CASE 
              WHEN sender_id = ? AND sender_type = ? THEN CONCAT(recipient_id, '_', recipient_type)
              ELSE CONCAT(sender_id, '_', sender_type)
            END as conversation_id
           FROM messages 
           WHERE (sender_id = ? AND sender_type = ?) OR (recipient_id = ? AND recipient_type = ?)`,
          [userId, userType, userId, userType, userId, userType],
          'skydek_DB'
        );

        // Join conversation rooms
        conversations.forEach(conv => {
          socket.join(`conversation_${conv.conversation_id}`);
        });

        // Broadcast presence update to contacts
        const contacts = await getContactsForPresence(userId, userType);
        contacts.forEach(contact => {
          socket.to(`user_${contact.type}_${contact.id}`).emit('presenceUpdate', {
            userId,
            userType,
            status: 'online',
            lastSeen: new Date().toISOString()
          });
        });

        socket.emit('authenticated', { 
          message: 'Successfully authenticated',
          room: socket.userRoom 
        });

        console.log(`✅ User authenticated: ${userId} (${userType}) - Socket: ${socket.id}`);
      } catch (error) {
        console.error('❌ Authentication error:', error);
        socket.emit('authError', { message: 'Authentication failed' });
      }
    });

    // Handle typing indicators
    socket.on('startTyping', async (data) => {
      try {
        const { conversationId } = data;
        const { userId, userType } = socket;

        if (!userId || !conversationId) return;

        // Set typing indicator with expiration
        const expiresAt = new Date(Date.now() + 10000); // 10 seconds
        await execute(
          `INSERT INTO typing_indicators (conversation_id, user_id, user_type, is_typing, expires_at)
           VALUES (?, ?, ?, TRUE, ?)
           ON DUPLICATE KEY UPDATE is_typing = TRUE, started_at = NOW(), expires_at = VALUES(expires_at)`,
          [conversationId, userId, userType, expiresAt],
          'skydek_DB'
        );

        // Broadcast to conversation participants (except sender)
        socket.to(`conversation_${conversationId}`).emit('userTyping', {
          conversationId,
          userId,
          userType,
          isTyping: true,
          expiresAt: expiresAt.toISOString()
        });

        console.log(`⌨️ User ${userId} started typing in conversation ${conversationId}`);
      } catch (error) {
        console.error('❌ Error handling startTyping:', error);
      }
    });

    socket.on('stopTyping', async (data) => {
      try {
        const { conversationId } = data;
        const { userId, userType } = socket;

        if (!userId || !conversationId) return;

        // Remove typing indicator
        await execute(
          `DELETE FROM typing_indicators 
           WHERE conversation_id = ? AND user_id = ? AND user_type = ?`,
          [conversationId, userId, userType],
          'skydek_DB'
        );

        // Broadcast to conversation participants
        socket.to(`conversation_${conversationId}`).emit('userTyping', {
          conversationId,
          userId,
          userType,
          isTyping: false
        });

        console.log(`⌨️ User ${userId} stopped typing in conversation ${conversationId}`);
      } catch (error) {
        console.error('❌ Error handling stopTyping:', error);
      }
    });

    // Handle real-time message delivery
    socket.on('newMessage', async (data) => {
      try {
        const { messageId, recipientId, recipientType, conversationId } = data;
        const { userId, userType } = socket;

        if (!messageId || !recipientId || !recipientType) return;

        // Check if recipient is online
        const [recipientPresence] = await query(
          'SELECT status, socket_id FROM user_presence WHERE user_id = ? AND user_type = ?',
          [recipientId, recipientType],
          'skydek_DB'
        );

        if (recipientPresence && recipientPresence.status === 'online') {
          // Mark as delivered
          await execute(
            `UPDATE messages SET message_status = 'delivered', delivered_at = NOW() WHERE id = ?`,
            [messageId],
            'skydek_DB'
          );

          await execute(
            `UPDATE message_delivery SET delivery_status = 'delivered', delivered_at = NOW() 
             WHERE message_id = ? AND user_id = ? AND user_type = ?`,
            [messageId, recipientId, recipientType],
            'skydek_DB'
          );

          // Send delivery receipt to sender
          socket.emit('messageDelivered', {
            messageId,
            deliveredAt: new Date().toISOString(),
            recipientId,
            recipientType
          });

          // Notify recipient of new message
          socket.to(`user_${recipientType}_${recipientId}`).emit('newMessageReceived', {
            messageId,
            senderId: userId,
            senderType: userType,
            conversationId,
            deliveredAt: new Date().toISOString()
          });
        }

        console.log(`📨 Message ${messageId} processed for delivery`);
      } catch (error) {
        console.error('❌ Error handling newMessage:', error);
      }
    });

    // Handle message read receipts
    socket.on('markAsRead', async (data) => {
      try {
        const { messageId, senderId, senderType } = data;
        const { userId, userType } = socket;

        if (!messageId) return;

        // Update message as read
        await execute(
          `UPDATE messages SET message_status = 'read', read_at = NOW() 
           WHERE id = ? AND recipient_id = ? AND recipient_type = ?`,
          [messageId, userId, userType],
          'skydek_DB'
        );

        // Update delivery tracking
        await execute(
          `UPDATE message_delivery SET delivery_status = 'read', read_at = NOW() 
           WHERE message_id = ? AND user_id = ? AND user_type = ?`,
          [messageId, userId, userType],
          'skydek_DB'
        );

        // Send read receipt to sender
        if (senderId && senderType) {
          socket.to(`user_${senderType}_${senderId}`).emit('messageRead', {
            messageId,
            readBy: userId,
            readByType: userType,
            readAt: new Date().toISOString()
          });
        }

        console.log(`✅ Message ${messageId} marked as read by ${userId}`);
      } catch (error) {
        console.error('❌ Error handling markAsRead:', error);
      }
    });

    // Handle message reactions
    socket.on('addReaction', async (data) => {
      try {
        const { messageId, emoji } = data;
        const { userId, userType } = socket;

        if (!messageId || !emoji) return;

        // Add reaction to database
        await execute(
          `INSERT INTO message_reactions (message_id, user_id, user_type, reaction_emoji)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE reaction_emoji = VALUES(reaction_emoji), created_at = NOW()`,
          [messageId, userId, userType, emoji],
          'skydek_DB'
        );

        // Get message details to notify participants
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

          // Broadcast reaction to all participants
          participants.forEach(participant => {
            io.to(participant).emit('reactionAdded', {
              messageId,
              emoji,
              userId,
              userType,
              timestamp: new Date().toISOString()
            });
          });
        }

        console.log(`😊 Reaction ${emoji} added to message ${messageId} by ${userId}`);
      } catch (error) {
        console.error('❌ Error handling addReaction:', error);
      }
    });

    // Handle presence status updates
    socket.on('updateStatus', async (data) => {
      try {
        const { status } = data;
        const { userId, userType } = socket;

        if (!userId || !status) return;

        // Update presence status
        await execute(
          `UPDATE user_presence 
           SET status = ?, last_seen = NOW() 
           WHERE user_id = ? AND user_type = ?`,
          [status, userId, userType],
          'skydek_DB'
        );

        // Broadcast to contacts
        const contacts = await getContactsForPresence(userId, userType);
        contacts.forEach(contact => {
          socket.to(`user_${contact.type}_${contact.id}`).emit('presenceUpdate', {
            userId,
            userType,
            status,
            lastSeen: new Date().toISOString()
          });
        });

        console.log(`🟢 Status updated for ${userId}: ${status}`);
      } catch (error) {
        console.error('❌ Error handling updateStatus:', error);
      }
    });

    // Handle join conversation room
    socket.on('joinConversation', (data) => {
      const { conversationId } = data;
      if (conversationId) {
        socket.join(`conversation_${conversationId}`);
        console.log(`🏠 User ${socket.userId} joined conversation ${conversationId}`);
      }
    });

    // Handle leave conversation room
    socket.on('leaveConversation', (data) => {
      const { conversationId } = data;
      if (conversationId) {
        socket.leave(`conversation_${conversationId}`);
        console.log(`🚪 User ${socket.userId} left conversation ${conversationId}`);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      try {
        if (socket.userId && socket.userType) {
          // Update presence to offline
          await execute(
            `UPDATE user_presence 
             SET status = 'offline', last_seen = NOW(), socket_id = NULL
             WHERE user_id = ? AND user_type = ?`,
            [socket.userId, socket.userType],
            'skydek_DB'
          );

          // Clean up typing indicators
          await execute(
            `DELETE FROM typing_indicators 
             WHERE user_id = ? AND user_type = ?`,
            [socket.userId, socket.userType],
            'skydek_DB'
          );

          // Broadcast offline status to contacts
          const contacts = await getContactsForPresence(socket.userId, socket.userType);
          contacts.forEach(contact => {
            socket.to(`user_${contact.type}_${contact.id}`).emit('presenceUpdate', {
              userId: socket.userId,
              userType: socket.userType,
              status: 'offline',
              lastSeen: new Date().toISOString()
            });
          });

          console.log(`🔌 User ${socket.userId} (${socket.userType}) disconnected`);
        }
      } catch (error) {
        console.error('❌ Error handling disconnect:', error);
      }
    });

    // Handle heartbeat for presence
    socket.on('heartbeat', async () => {
      try {
        if (socket.userId && socket.userType) {
          await execute(
            `UPDATE user_presence SET last_seen = NOW() WHERE user_id = ? AND user_type = ?`,
            [socket.userId, socket.userType],
            'skydek_DB'
          );
        }
      } catch (error) {
        console.error('❌ Error handling heartbeat:', error);
      }
    });
  });

  // Cleanup expired typing indicators every minute
  setInterval(async () => {
    try {
      await execute(
        'DELETE FROM typing_indicators WHERE expires_at < NOW()',
        [],
        'skydek_DB'
      );
    } catch (error) {
      console.error('❌ Error cleaning up typing indicators:', error);
    }
  }, 60000);

  // Update offline status for inactive users every 2 minutes
  setInterval(async () => {
    try {
      const offlineUsers = await query(
        `SELECT user_id, user_type FROM user_presence 
         WHERE last_seen < DATE_SUB(NOW(), INTERVAL 5 MINUTE) 
         AND status != 'offline'`,
        [],
        'skydek_DB'
      );

      for (const user of offlineUsers) {
        await execute(
          `UPDATE user_presence SET status = 'offline' 
           WHERE user_id = ? AND user_type = ?`,
          [user.user_id, user.user_type],
          'skydek_DB'
        );

        // Broadcast offline status
        const contacts = await getContactsForPresence(user.user_id, user.user_type);
        contacts.forEach(contact => {
          io.to(`user_${contact.type}_${contact.id}`).emit('presenceUpdate', {
            userId: user.user_id,
            userType: user.user_type,
            status: 'offline',
            lastSeen: new Date().toISOString()
          });
        });
      }

      if (offlineUsers.length > 0) {
        console.log(`🔄 Updated ${offlineUsers.length} users to offline status`);
      }
    } catch (error) {
      console.error('❌ Error updating offline status:', error);
    }
  }, 120000);

  console.log('✅ Enhanced messaging WebSocket handlers set up successfully');
}

// Helper function to get contacts for presence updates
async function getContactsForPresence(userId, userType) {
  try {
    const contacts = await query(
      `SELECT DISTINCT 
        CASE 
          WHEN sender_id = ? AND sender_type = ? THEN recipient_id
          ELSE sender_id
        END as id,
        CASE 
          WHEN sender_id = ? AND sender_type = ? THEN recipient_type
          ELSE sender_type
        END as type
       FROM messages 
       WHERE (sender_id = ? AND sender_type = ?) OR (recipient_id = ? AND recipient_type = ?)`,
      [userId, userType, userId, userType, userId, userType, userId, userType],
      'skydek_DB'
    );

    return contacts.filter(contact => contact.id !== userId || contact.type !== userType);
  } catch (error) {
    console.error('❌ Error getting contacts for presence:', error);
    return [];
  }
} 