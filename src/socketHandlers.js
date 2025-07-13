/**
 * Socket.IO Event Handlers for Young Eagles API
 * Handles real-time notifications and profile updates
 */

import jwt from 'jsonwebtoken';
import { getUserById } from './models/User.js';
import { getUnreadNotificationCount } from './models/Notification.js';

// Store connected users and their socket connections
const connectedUsers = new Map();

/**
 * Middleware to authenticate socket connections
 */
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserById(decoded.id);
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user.id;
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
};

/**
 * Handle user connection
 */
const handleConnection = async (socket) => {
  console.log(`User ${socket.user.username} connected via WebSocket`);
  
  // Store the connection
  connectedUsers.set(socket.userId, socket);
  
  // Join user-specific room
  socket.join(`user:${socket.userId}`);
  
  // Send initial data
  try {
    const unreadCount = await getUnreadNotificationCount(socket.userId);
    socket.emit('notification:count', { count: unreadCount });
  } catch (error) {
    console.error('Error fetching initial notification count:', error);
  }

  // Handle profile refresh request
  socket.on('profile:refresh', async () => {
    try {
      const user = await getUserById(socket.userId);
      if (user) {
        socket.emit('profile:updated', user);
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
      socket.emit('profile:error', { message: 'Failed to refresh profile' });
    }
  });

  // Handle notification count refresh request
  socket.on('notification:refresh', async () => {
    try {
      const count = await getUnreadNotificationCount(socket.userId);
      socket.emit('notification:count', { count });
    } catch (error) {
      console.error('Error refreshing notification count:', error);
      socket.emit('notification:error', { message: 'Failed to refresh notifications' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`User ${socket.user.username} disconnected: ${reason}`);
    connectedUsers.delete(socket.userId);
  });
};

/**
 * Emit notification count update to a specific user
 */
const emitNotificationCount = async (io, userId) => {
  try {
    const count = await getUnreadNotificationCount(userId);
    io.to(`user:${userId}`).emit('notification:count', { count });
  } catch (error) {
    console.error('Error emitting notification count:', error);
  }
};

/**
 * Emit new notification to a specific user
 */
const emitNewNotification = (io, userId, notification) => {
  io.to(`user:${userId}`).emit('notification:new', notification);
};

/**
 * Emit profile update to a specific user
 */
const emitProfileUpdate = (io, userId, profile) => {
  io.to(`user:${userId}`).emit('profile:updated', profile);
};

/**
 * Initialize Socket.IO handlers
 */
const initializeSocketHandlers = (io) => {
  // Apply authentication middleware
  io.use(authenticateSocket);
  
  // Handle connections
  io.on('connection', handleConnection);
  
  return {
    emitNotificationCount,
    emitNewNotification,
    emitProfileUpdate
  };
};

export {
  initializeSocketHandlers,
  emitNotificationCount,
  emitNewNotification,
  emitProfileUpdate,
  connectedUsers
};
