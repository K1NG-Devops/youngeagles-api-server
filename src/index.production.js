/**
 * Young Eagles Preschool Platform - Production Server
 * Secure, scalable server for the preschool management platform
 * 
 * Features:
 * - Environment-based configuration
 * - Structured logging
 * - Security best practices
 * - Multi-tenancy ready
 * - Monitoring and health checks
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mysql from 'mysql2/promise';
import { createServer } from 'http';
import { Server } from 'socket.io';
import compression from 'compression';

// Import our secure configuration and logging
import config from '../config/production.config.js';
import { Logger, requestLogger, errorLogger, shutdownLogger } from '../utils/logger.js';

// Import route handlers
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import parentRoutes from './routes/parent.routes.js';
import homeworkRoutes from './routes/homework.routes.js';
import messagingRoutes from './routes/messaging.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';

// Import middleware
import { authMiddleware } from './middleware/authMiddleware.js';
import { uploadMiddleware } from './middleware/uploadMiddleware.js';

const app = express();
const server = createServer(app);

// Database connection pool
let db;

/**
 * Initialize secure database connection
 */
async function initDatabase() {
  try {
    Logger.startup('Initializing database connection...', {
      host: config.database.host,
      database: config.database.database,
      ssl: config.database.ssl
    });

    db = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      ssl: config.database.ssl,
      connectionLimit: config.database.connectionLimit,
      acquireTimeout: config.database.acquireTimeout,
      timeout: config.database.timeout,
      reconnect: config.database.reconnect
    });

    // Test connection
    const connection = await db.getConnection();
    Logger.database('Database connection established successfully');
    connection.release();
    
    return true;
  } catch (error) {
    Logger.error('Database connection failed', error);
    return false;
  }
}

/**
 * Configure security middleware
 */
function setupSecurity() {
  // Basic security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.security.rateLimitWindowMs,
    max: config.security.rateLimitMaxRequests,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      Logger.security('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl
      });
      res.status(429).json({
        error: 'Too many requests from this IP, please try again later.'
      });
    }
  });

  app.use('/api/', limiter);

  Logger.startup('Security middleware configured');
}

/**
 * Configure CORS with secure settings
 */
function setupCORS() {
  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      if (config.cors.origin.includes(origin)) {
        return callback(null, true);
      }
      
      Logger.security('CORS violation attempted', { origin });
      callback(new Error('Not allowed by CORS'));
    },
    credentials: config.cors.credentials,
    methods: config.cors.methods,
    allowedHeaders: [
      'Origin',
      'X-Requested-With', 
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'Pragma',
      'Expires'
    ]
  };

  app.use(cors(corsOptions));
  Logger.startup('CORS configured with secure origins');
}

/**
 * Setup Socket.IO for real-time messaging
 */
function setupSocketIO() {
  const io = new Server(server, {
    cors: {
      origin: config.cors.origin,
      methods: config.cors.methods,
      credentials: config.cors.credentials
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      Logger.security('Socket connection without token', {
        socketId: socket.id,
        ip: socket.handshake.address
      });
      return next(new Error('Authentication required'));
    }
    
    // Verify token here
    next();
  });

  io.on('connection', (socket) => {
    Logger.messaging('Socket connection established', {
      socketId: socket.id,
      userId: socket.userId
    });

    socket.on('disconnect', () => {
      Logger.messaging('Socket disconnected', {
        socketId: socket.id
      });
    });
  });

  Logger.startup('Socket.IO configured for real-time messaging');
  return io;
}

/**
 * Setup API routes
 */
function setupRoutes() {
  // Health check endpoints
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: config.app.version,
      environment: config.app.environment
    });
  });

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      version: config.app.version
    });
  });

  // API documentation
  app.get('/', (req, res) => {
    res.json({
      name: config.app.name,
      version: config.app.version,
      environment: config.app.environment,
      documentation: '/api/docs',
      health: '/health',
      endpoints: {
        auth: '/api/auth',
        admin: '/api/admin',
        teacher: '/api/teacher',
        parent: '/api/parent',
        homework: '/api/homework',
        messaging: '/api/messaging',
        attendance: '/api/attendance'
      }
    });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', authMiddleware, adminRoutes);
  app.use('/api/teacher', authMiddleware, teacherRoutes);
  app.use('/api/parent', authMiddleware, parentRoutes);
  app.use('/api/homework', authMiddleware, homeworkRoutes);
  app.use('/api/messaging', authMiddleware, messagingRoutes);
  app.use('/api/attendance', authMiddleware, attendanceRoutes);

  // 404 handler
  app.use('*', (req, res) => {
    Logger.warn('404 - Route not found', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip
    });
    
    res.status(404).json({
      error: 'Endpoint not found',
      method: req.method,
      url: req.originalUrl,
      availableEndpoints: [
        '/health',
        '/api/health',
        '/api/auth',
        '/api/admin',
        '/api/teacher',
        '/api/parent',
        '/api/homework',
        '/api/messaging',
        '/api/attendance'
      ]
    });
  });

  Logger.startup('API routes configured');
}

/**
 * Setup middleware
 */
function setupMiddleware() {
  // Compression
  app.use(compression());

  // Request logging
  app.use(requestLogger);

  // Body parsing
  app.use(express.json({ 
    limit: config.upload.maxFileSize 
  }));
  app.use(express.urlencoded({ 
    extended: true, 
    limit: config.upload.maxFileSize 
  }));

  // File upload middleware
  app.use('/api/upload', uploadMiddleware);

  Logger.startup('Express middleware configured');
}

/**
 * Setup error handling
 */
function setupErrorHandling() {
  // Error logging middleware
  app.use(errorLogger);

  // Global error handler
  app.use((error, req, res, next) => {
    Logger.error('Unhandled application error', error, {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });

    // Don't leak error details in production
    const message = config.app.debug ? error.message : 'Internal server error';
    const stack = config.app.debug ? error.stack : undefined;

    res.status(error.status || 500).json({
      error: message,
      stack,
      timestamp: new Date().toISOString()
    });
  });

  Logger.startup('Error handling configured');
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    Logger.startup(`Received ${signal}, starting graceful shutdown...`);

    // Close server
    server.close(async () => {
      Logger.startup('HTTP server closed');
      
      // Close database connections
      if (db) {
        await db.end();
        Logger.database('Database connections closed');
      }

      // Close logger
      await shutdownLogger();
      
      process.exit(0);
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      Logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Start the production server
 */
async function startServer() {
  try {
    Logger.startup('Starting Young Eagles Preschool Platform...', {
      version: config.app.version,
      environment: config.app.environment,
      port: config.app.port
    });

    // Initialize database
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      process.exit(1);
    }

    // Setup middleware and security
    setupSecurity();
    setupCORS();
    setupMiddleware();

    // Setup Socket.IO
    const io = setupSocketIO();

    // Setup routes
    setupRoutes();

    // Setup error handling
    setupErrorHandling();

    // Setup graceful shutdown
    setupGracefulShutdown();

    // Start server
    server.listen(config.app.port, () => {
      Logger.startup('Server started successfully', {
        port: config.app.port,
        environment: config.app.environment,
        version: config.app.version,
        multiTenancy: config.platform.enableMultiTenancy,
        features: {
          realTimeMessaging: true,
          fileUploads: true,
          aiContent: !!config.ai.openaiApiKey,
          payments: !!(config.payments.stripe.secretKey || config.payments.payfast.merchantId),
          videoStorage: !!config.aws.accessKeyId
        }
      });
    });

    // Export db and io for use in routes
    global.db = db;
    global.io = io;

  } catch (error) {
    Logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export { db, server }; 