/**
 * Young Eagles API Server Configuration - Minimal Version
 * Basic Express app, HTTP server, and Socket.io setup
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

// Create Express app
const app = express();

// Configure trust proxy for production environments
if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  console.log('🔧 Trust proxy enabled for production deployment');
}

// Basic allowed origins
const allowedOrigins = [
  'http://localhost:3002', 
  'http://localhost:3003', 
  'http://localhost:5173',
  'https://youngeagles.org.za',
  'https://www.youngeagles.org.za'
];

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin) return callback(null, true);
    
    // Check allowed origins
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    // Allow vercel deployments
    if (origin.includes('vercel.app')) {
      return callback(null, true);
    }
    
    // Development mode - be permissive
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    const msg = `CORS policy blocked origin: ${origin}`;
    return callback(new Error(msg), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  allowedHeaders: [
    'Origin', 
    'X-Requested-With', 
    'Content-Type', 
    'Accept', 
    'Authorization'
  ]
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Basic security and performance
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Basic rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// Request logging
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Create HTTP server
const server = createServer(app);

// Setup Socket.io
const io = new SocketIO(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

// Basic Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

export { app, server, io }; 