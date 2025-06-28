/**
 * Young Eagles API Server Configuration
 * Sets up Express app, HTTP server, and Socket.io
 * Based on the original comprehensive setup from backup
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app
const app = express();

// Configure trust proxy for Railway
if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy (Railway)
  console.log('🔧 Trust proxy enabled for Railway deployment');
}

// Comprehensive allowed origins from backup
const allowedOrigins = [
  "http://localhost:3002", 
  "http://localhost:3003", 
  "http://localhost:5173",
  "https://youngeagles.org.za",
  "https://www.youngeagles.org.za",
  "https://youngeagles-api-server.up.railway.app",
  "https://youngeagles-g4tu8n56q-k1ng-devops-projects.vercel.app",
  // Add more comprehensive domain coverage
  "https://app.youngeagles.org.za",
  "https://admin.youngeagles.org.za",
  "https://api.youngeagles.org.za"
];

// More permissive CORS for production issues (from backup)
const corsOptions = {
  origin: function (origin, callback) {
    console.log(`🌐 CORS request from origin: ${origin || 'no origin'}`);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('✅ Allowing request with no origin');
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log(`✅ Origin ${origin} is in allowed list`);
      return callback(null, true);
    }
    
    // Check for Vercel preview deployments (dynamic URLs)
    if (origin.includes('vercel.app')) {
      console.log(`✅ Allowing Vercel deployment: ${origin}`);
      return callback(null, true);
    }
    
    // Check for custom domains that might be configured
    if (origin.includes('youngeagles')) {
      console.log(`✅ Allowing youngeagles domain: ${origin}`);
      return callback(null, true);
    }
    
    // In development, be more permissive
    if (process.env.NODE_ENV !== 'production') {
      console.log(`⚠️ Development mode: allowing ${origin}`);
      return callback(null, true);
    }
    
    console.log(`❌ CORS blocked origin: ${origin}`);
    const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
    return callback(new Error(msg), false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
  allowedHeaders: [
    'Origin', 
    'X-Requested-With', 
    'Content-Type', 
    'Accept', 
    'Authorization', 
    'Cache-Control', 
    'Pragma', 
    'Expires', 
    'x-request-source',
    'Access-Control-Allow-Origin'
  ]
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

// Custom CORS middleware for additional headers (from backup)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Always allow health check endpoints
  if (req.path === '/api/health' || req.path === '/health' || req.path === '/') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Expires, x-request-source');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      console.log('🔄 Handling OPTIONS preflight request for health check');
      return res.status(200).end();
    }
    
    console.log(`💓 Health check request: ${req.method} ${req.path}`);
    return next();
  }
  
  if (origin) {
    console.log(`📡 ${req.method} ${req.path} - Origin: ${origin}`);
    
    // Allow Railway and Vercel domains
    if (origin.includes('railway.app') || origin.includes('vercel.app') || origin.includes('youngeagles.org.za') ||
        ['http://localhost:3002', 'http://localhost:3003', 'http://localhost:5173'].includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      console.log(`✅ Setting Access-Control-Allow-Origin: ${origin}`);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
      console.log(`✅ Setting Access-Control-Allow-Origin: * (permissive for unknown origin: ${origin})`);
    }
  } else {
    console.log(`📡 ${req.method} ${req.path} - Origin: none`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    console.log('✅ Setting Access-Control-Allow-Origin: * (for no origin)');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Expires, x-request-source');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling OPTIONS preflight request');
    return res.status(200).end();
  }
  
  next();
});

// Production security and performance middleware
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;

if (isProduction) {
  // Compression for better performance
  app.use(compression());
  
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for API server
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);
} else {
  // Development-friendly settings
  app.use(compression());
  
  // Less strict security headers for development
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
  
  // More lenient rate limiting for development
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // More requests allowed in development
    message: {
      error: 'Too many requests',
      message: 'Please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api/', limiter);
}

// Body parsing middleware with larger limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Basic security headers
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Create HTTP server
const server = createServer(app);

// Setup Socket.io with comprehensive CORS
const io = new SocketIO(server, {
  cors: corsOptions,
  path: "/socket.io/",
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Socket.io connection logging
io.on('connection', (socket) => {
  console.log(`🔌 Socket.io client connected: ${socket.id}`);
  
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Socket.io client disconnected: ${socket.id} - Reason: ${reason}`);
  });
});

// Error handling middleware for Express
app.use((err, req, res, next) => {
  console.error('❌ Express error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation error',
      error: err.message
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      message: 'Unauthorized',
      error: 'Invalid token'
    });
  }
  
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      message: 'CORS error',
      error: err.message
    });
  }
  
  res.status(500).json({
    message: 'Internal server error',
    error: isProduction ? 'Something went wrong' : err.message
  });
});

// Note: 404 handler should be registered AFTER all routes in index.js

export { app, server, io }; 