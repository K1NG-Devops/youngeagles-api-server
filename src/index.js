import dotenv from 'dotenv';
dotenv.config();

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Import server configuration
import { app, server, io } from './config/server.js';

// Import database configuration
import { initDatabase, db } from './db.js';

// Import security utilities
import { PasswordSecurity, TokenManager, verifyToken } from './utils/security.js';

// Import WebSocket events
import { AdminWebSocketEvents } from './websocket-admin-events.js';
import { MessageWebSocketEvents } from './websocket-message-events.js';
import setupMessagingEndpoints from './messaging-endpoints.js';

// Import route modules
import authRoutes from './routes/auth.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import adminRoutes from './routes/admin.routes.js';
import parentRoutes from './routes/parent.routes.js';
import childrenRoutes from './routes/children.routes.js';
import homeworkRoutes from './routes/homework.routes.js';
import messagingRoutes from './routes/messaging.routes.js';
import classRoutes from './routes/classes.routes.js';
import publicRoutes from './routes/public.routes.js';
import pushRoutes from './routes/push.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;

// Database configuration - SECURE FOR PRODUCTION
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true',
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
  timeout: parseInt(process.env.DB_TIMEOUT) || 60000,
  reconnect: true
};

// Validate required database environment variables
const requiredDbVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingDbVars = requiredDbVars.filter(varName => !process.env[varName]);

if (missingDbVars.length > 0) {
  console.error('❌ Missing required database environment variables:', missingDbVars);
  console.error('🚨 Please set the following environment variables:');
  missingDbVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('🚨 For production, ensure all credentials are set via environment variables');
  process.exit(1);
}

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images (JPG, PNG, GIF) and documents (PDF, DOC, DOCX) are allowed.'));
    }
  }
});

// Database helper functions
async function findUserByEmail(email, role = null) {
  try {
    if (!db) {
      console.log('⚠️ Database not available for user lookup');
      return null;
    }
    
    let query = 'SELECT * FROM users WHERE email = ?';
    let params = [email];
    
    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }
    
    const [rows] = await db.execute(query, params);
    return rows[0] || null;
  } catch (error) {
    console.error('❌ Database query error:', error);
    return null;
  }
}

async function findStaffByEmail(email) {
  try {
    if (!db) {
      console.log('⚠️ Database not available for staff lookup');
      return null;
    }
    
    const [rows] = await db.execute('SELECT * FROM staff WHERE email = ?', [email]);
    return rows[0] || null;
  } catch (error) {
    console.error('❌ Database query error:', error);
    return null;
  }
}

// Initialize server
async function startServer() {
  console.log('🚀 Starting Young Eagles API Server...');
  
  // Detect environment properly
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
  console.log('📍 Environment:', isProduction ? 'PRODUCTION' : 'LOCAL DEVELOPMENT');
  console.log('🔧 Phase: PRODUCTION READY');
  
  // Try to connect to database but don't fail if it doesn't work
  console.log('🔌 Attempting database connection...');
  const dbConnected = await initDatabase();
  if (!dbConnected) {
    console.log('⚠️ Database connection failed - continuing with limited functionality');
    console.log('⚠️ Only basic health check endpoints will work');
  } else {
    console.log('✅ Database connected - full functionality available');
  }
  
  console.log('🔐 Setting up production authentication system...');
  console.log('🛡️ Password requirements: 8+ chars, uppercase, lowercase, numbers, special chars');
  console.log('🚫 All mock data removed - using real database');

  // Mount the messaging routes
  app.use('/api/messaging', messagingRoutes);

  // Setup messaging endpoints
  setupMessagingEndpoints(app, io);

  // Initialize WebSocket events
  const adminWebSocketEvents = new AdminWebSocketEvents(io);
  const messageWebSocketEvents = new MessageWebSocketEvents(io, db);
  
  // Setup WebSocket connection handlers
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    
    // Handle message events
    messageWebSocketEvents.handleConnection(socket);
    
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      messageWebSocketEvents.handleDisconnection(socket);
    });
  });

  // Health check endpoint - ALWAYS works regardless of database
  app.get('/api/health', async (req, res) => {
    console.log('💓 Health check requested');
    
    // Always return 200 for Railway health checks
    let dbStatus = 'unknown';
    try {
      if (db && dbConnected) {
        const connection = await Promise.race([
          db.getConnection(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
        connection.release();
        dbStatus = 'connected';
      } else {
        dbStatus = 'disconnected';
      }
    } catch (error) {
      console.log('⚠️ Health check database test failed:', error.message);
      dbStatus = 'error';
    }
    
    // Always return 200 for Railway requirements
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      environment: isProduction ? 'production' : 'development',
      database: dbStatus,
      authentication: 'secure',
      version: '3.0.0'
    });
  });

  // Database health check endpoint
  app.get('/api/health/db', async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({
          status: 'unhealthy',
          message: 'Database not initialized',
          timestamp: new Date().toISOString()
        });
      }

      const connection = await Promise.race([
        db.getConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 5000))
      ]);
      
      // Test a simple query
      const [result] = await connection.execute('SELECT 1 as test');
      connection.release();

      res.json({
        status: 'healthy',
        message: 'Database connection successful',
        timestamp: new Date().toISOString(),
        test_query_result: result[0].test
      });
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        message: 'Database connection failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Root endpoint for API info
  app.get('/', (req, res) => {
    console.log('📋 API info requested');
    res.json({ 
      message: 'Young Eagles API Server is running',
      status: 'healthy',
      version: '3.1.2',
      environment: isProduction ? 'production' : 'development',
      timestamp: new Date().toISOString(),
      deployment_id: 'railway-deploy-v3.1.2-' + Date.now(),
      endpoints: {
        health: '/api/health',
        api: '/api',
        auth: '/api/auth/*',
        admin: '/api/admin/*',
        parent: '/api/parent/*',
        children: '/api/children/*',
        homework: '/api/homework/*'
      }
    });
  });

  // API info endpoint
  app.get('/api', (req, res) => {
    console.log('📋 API endpoints info requested');
    res.json({ 
      message: 'Young Eagles API Server',
      version: '3.1.2',
      environment: isProduction ? 'production' : 'development',
      deployment_id: 'railway-deploy-v3.1.2-' + Date.now(),
      endpoints: {
        auth: '/api/auth/*',
        admin: '/api/admin/*',
        parent: '/api/parent/*',
        teacher: '/api/teacher/*',
        homework: '/api/homework/*',
        children: '/api/children/*',
        notifications: '/api/notifications',
        messages: '/api/messages'
      }
    });
  });

  // Mount route modules
  app.use('/api/auth', authRoutes);
  app.use('/api/teacher', teacherRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/parent', parentRoutes);
  app.use('/api/children', childrenRoutes);
  app.use('/api/homework', homeworkRoutes);
  app.use('/api/classes', classRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/push', pushRoutes);

  // Redirect old routes to new API routes
  app.get('/children/teacher/:teacherId', (req, res) => {
    res.redirect(307, `/api/children/teacher/${req.params.teacherId}`);
  });

  app.get('/homework/teacher/submissions', (req, res) => {
    res.redirect(307, '/api/homework/teacher/submissions');
  });

  // Notifications endpoint (should be moved to notifications.routes.js)
  app.get('/api/notifications', async (req, res) => {
    console.log('🔔 Notifications requested');
    try {
      const user = verifyToken(req);
      if (!user) {
        return res.status(403).json({
          message: 'Forbidden - authentication required',
          error: 'FORBIDDEN'
        });
      }

      // For now, return empty notifications
      res.json({
        success: true,
        notifications: [],
        message: 'Notifications fetched successfully'
      });
      
    } catch (error) {
      console.error('❌ Notifications error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Messages endpoint (should be moved to messaging.routes.js)
  app.get('/api/messages', async (req, res) => {
    console.log('💬 Messages requested');
    try {
      const user = verifyToken(req);
      if (!user) {
        return res.status(403).json({
          message: 'Forbidden - authentication required',
          error: 'FORBIDDEN'
        });
      }

      // For now, return empty messages
      res.json({
        success: true,
        messages: [],
        message: 'Messages fetched successfully'
      });
      
    } catch (error) {
      console.error('❌ Messages error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // 404 handler - must be AFTER all routes are registered
  app.use('*', (req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
      message: 'Endpoint not found',
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  });

  // Start the server
  server.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🎉 YOUNG EAGLES API SERVER STARTED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`🌐 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📊 API Info: http://localhost:${PORT}/api`);
    console.log(`🔐 Authentication: Secure (Password + Token based)`);
    console.log(`📚 Database: ${dbConnected ? 'Connected' : 'Disconnected'}`);
    console.log('='.repeat(60));
    
    if (!dbConnected) {
      console.log('⚠️  WARNING: Database connection failed');
      console.log('⚠️  Only health check endpoints will work');
      console.log('⚠️  Please check database configuration');
      console.log('='.repeat(60));
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('✅ Server closed');
      if (db) {
        db.end();
        console.log('✅ Database connection closed');
      }
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(async () => {
      console.log('✅ Server closed');
      try {
        if (db) {
          await db.end();
          console.log('✅ Main database connection pool closed');
        }
        // Also close the legacy cached pools
        const { close: closeLegacyPools } = await import('./db.js');
        await closeLegacyPools();
        console.log('✅ All database connections closed');
        process.exit(0);
      } catch (err) {
        console.error('❌ Error during database connection closing:', err);
        process.exit(1);
      }
    });

    // Force shutdown if graceful exit fails
    setTimeout(() => {
      console.error('⚠️ Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 5000); // 5-second timeout
  });
}

// Start the server
startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}); 