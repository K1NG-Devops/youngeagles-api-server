/**
 * Message WebSocket Events Handler
 * Handles real-time messaging events
 */

export class MessageWebSocketEvents {
  constructor(io, db) {
    this.io = io;
    this.db = db;
    this.connectedUsers = new Map(); // userId -> socketId
  }

  // Handle user connection
  handleConnection(socket) {
    const { userId, role } = socket.handshake.query;
    
    if (userId) {
      // Store user connection
      this.connectedUsers.set(userId, socket.id);
      console.log(`👤 User ${userId} connected with socket ${socket.id}`);
      
      // Join user-specific room
      socket.join(`user_${userId}`);
      
      // Join role-based room if provided
      if (role) {
        socket.join(`role_${role}`);
        console.log(`👥 User ${userId} joined ${role} room`);
      }
    }

    // Setup message event handlers
    this.setupMessageHandlers(socket);
  }

  // Handle user disconnection
  handleDisconnection(socket) {
    const { userId } = socket.handshake.query;
    
    if (userId) {
      this.connectedUsers.delete(userId);
      console.log(`👤 User ${userId} disconnected`);
    }
  }

  // Setup message event handlers for a socket
  setupMessageHandlers(socket) {
    const { userId } = socket.handshake.query;

    // Handle new messages
    socket.on('send_message', async (data) => {
      console.log('📨 New message received:', data);
      
      try {
        // Save message to database
        const [result] = await this.db.execute(
          'INSERT INTO messages (conversation_id, sender_id, message_text, created_at) VALUES (?, ?, ?, ?)',
          [data.conversationId, data.senderId, data.message, new Date()]
        );

        const messageId = result.insertId;
        
        // Get sender info
        const [sender] = await this.db.execute(
          'SELECT name FROM users WHERE id = ? UNION SELECT name FROM staff WHERE id = ?',
          [data.senderId, data.senderId]
        );

        const messageData = {
          id: messageId,
          ...data,
          senderName: sender[0]?.name || 'Unknown',
          status: 'delivered'
        };

        // Broadcast to conversation room
        this.io.to(data.conversationId).emit('new_message', messageData);
        
        console.log(`✅ Message ${messageId} saved and broadcast to conversation ${data.conversationId}`);
        
      } catch (error) {
        console.error('❌ Failed to process message:', error);
        socket.emit('message_error', { 
          error: 'Failed to save message',
          details: error.message 
        });
      }
    });

    // Handle typing indicators
    socket.on('user_typing', (data) => {
      socket.to(data.conversationId).emit('user_typing', {
        userId: data.userId,
        typing: data.typing,
        timestamp: data.timestamp
      });
    });

    // Handle joining conversations
    socket.on('join_conversation', (data) => {
      socket.join(data.conversationId);
      console.log(`👥 User ${userId} joined conversation ${data.conversationId}`);
    });

    // Handle leaving conversations
    socket.on('leave_conversation', (data) => {
      socket.leave(data.conversationId);
      console.log(`👥 User ${userId} left conversation ${data.conversationId}`);
    });
  }

  // Get user's socket ID
  getUserSocket(userId) {
    return this.connectedUsers.get(userId);
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  // Get online users count
  getOnlineUsersCount() {
    return this.connectedUsers.size;
  }

  // Send system message to user
  sendSystemMessage(userId, message, type = 'info') {
    const socketId = this.getUserSocket(userId);
    if (socketId) {
      this.io.to(socketId).emit('notification', {
        type,
        message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

export default MessageWebSocketEvents; 