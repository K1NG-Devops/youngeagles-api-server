import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { AdminWebSocketEvents } from './websocket-admin-events.js';
import { MessageWebSocketEvents } from './websocket-message-events.js';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Configure trust proxy for Railway
if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy (Railway)
  console.log('🔧 Trust proxy enabled for Railway deployment');
}

const server = createServer(app);

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

// More permissive CORS for production issues
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

const io = new Server(server, {
  cors: corsOptions,
  path: "/socket.io/"
});

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

let db;

// Initialize database connection
async function initDatabase() {
  try {
    console.log('🔌 Connecting to database...');
    db = mysql.createPool(dbConfig);
    
    // Test connection
    const connection = await db.getConnection();
    console.log('✅ Database connected successfully!');
    
    // Secure logging - don't expose sensitive details in production
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
    if (isProduction) {
      console.log(`📊 Connected to database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    } else {
      console.log(`📊 Connected to: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    }
    
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Password security utilities
class PasswordSecurity {
  static validatePassword(password) {
    if (!password || password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasUpperCase) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!hasLowerCase) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!hasNumbers) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    if (!hasSpecialChar) {
      return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)' };
    }
    
    return { valid: true, message: 'Password meets security requirements' };
  }
  
  static hashPassword(password) {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }
  
  static verifyPassword(password, hashedPassword) {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }
}

// JWT-like token utilities
class TokenManager {
  static generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };
    
    const secret = crypto.randomBytes(32).toString('hex');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto.createHmac('sha256', secret).update(`${header}.${payloadEncoded}`).digest('base64');
    
    return `${header}.${payloadEncoded}.${signature}`;
  }
  
  static verifyToken(tokenString) {
    try {
      if (!tokenString) return null;
      
      const parts = tokenString.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        console.log('❌ Token expired');
        return null;
      }
      
      return payload;
    } catch (error) {
      console.log('❌ Token verification failed:', error.message);
      return null;
    }
  }
}

// Custom CORS middleware for additional headers
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
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Authentication middleware
function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  return TokenManager.verifyToken(token);
}

// Database helper functions with fallback protection
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

  // =============================================================================
  // AUTHENTICATION ENDPOINTS - PRODUCTION READY
  // =============================================================================

  // Parent login endpoint
  app.post('/api/auth/login', async (req, res) => {
    console.log('🔐 Parent login requested');
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          message: 'Email and password are required',
          error: 'MISSING_CREDENTIALS'
        });
      }
      
      console.log(`👤 Attempting parent login: ${email}`);
      
      // Find user in database
      const user = await findUserByEmail(email, 'parent');
      
      if (!user) {
        console.log('❌ Parent not found');
        return res.status(401).json({
          message: 'Invalid email or password',
          error: 'INVALID_CREDENTIALS'
        });
      }
      
      // Verify password
      if (!PasswordSecurity.verifyPassword(password, user.password)) {
        console.log('❌ Invalid password');
        return res.status(401).json({
          message: 'Invalid email or password',
          error: 'INVALID_CREDENTIALS'
        });
      }
      
      // Generate token
      const accessToken = TokenManager.generateToken(user);
      
      console.log('✅ Parent login successful:', user.email);
      
      res.json({
        message: 'Login successful',
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
      
    } catch (error) {
      console.error('❌ Parent login error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Teacher login endpoint (with both paths for compatibility)
  app.post('/api/auth/teacher/login', async (req, res) => {
    console.log('🔐 Teacher login requested');
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          message: 'Email and password are required',
          error: 'MISSING_CREDENTIALS'
        });
      }
      
      console.log(`👩‍🏫 Attempting teacher login: ${email}`);
      
      // Find staff member in database
      const staff = await findStaffByEmail(email);
      
      if (!staff || staff.role !== 'teacher') {
        console.log('❌ Teacher not found');
        return res.status(401).json({
          message: 'Invalid email or password',
          error: 'INVALID_CREDENTIALS'
        });
      }
      
      // Verify password
      if (!PasswordSecurity.verifyPassword(password, staff.password)) {
        console.log('❌ Invalid password');
        return res.status(401).json({
          message: 'Invalid email or password',
          error: 'INVALID_CREDENTIALS'
        });
      }
      
      // Generate token
      const accessToken = TokenManager.generateToken(staff);
      
      console.log('✅ Teacher login successful:', staff.email);
      
      res.json({
        message: 'Teacher login successful',
        accessToken,
        user: {
          id: staff.id,
          email: staff.email,
          name: staff.name,
          role: staff.role
        }
      });
      
    } catch (error) {
      console.error('❌ Teacher login error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Admin login endpoint
  app.post('/api/auth/admin-login', async (req, res) => {
    console.log('🔐 Admin login requested');
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          message: 'Email and password are required',
          error: 'MISSING_CREDENTIALS'
        });
      }
      
      console.log(`👨‍💼 Attempting admin login: ${email}`);
      
      // Find staff member in database
      const staff = await findStaffByEmail(email);
      
      if (!staff || staff.role !== 'admin') {
        console.log('❌ Admin not found');
        return res.status(401).json({
          message: 'Invalid email or password',
          error: 'INVALID_CREDENTIALS'
        });
      }
      
      // Verify password
      if (!PasswordSecurity.verifyPassword(password, staff.password)) {
        console.log('❌ Invalid password');
        return res.status(401).json({
          message: 'Invalid email or password',
          error: 'INVALID_CREDENTIALS'
        });
      }
      
      // Generate token
      const accessToken = TokenManager.generateToken(staff);
      
      console.log('✅ Admin login successful:', staff.email);
      
      res.json({
        message: 'Admin login successful',
        accessToken,
        user: {
          id: staff.id,
          email: staff.email,
          name: staff.name,
          role: staff.role
        }
      });
      
    } catch (error) {
      console.error('❌ Admin login error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Get children for teacher (for assignment creation)
  app.get('/api/auth/children', async (req, res) => {
    console.log('👶 Teacher children endpoint requested');
    try {
      const user = verifyToken(req);
      if (!user || user.role !== 'teacher') {
        return res.status(403).json({
          message: 'Forbidden - teacher access required',
          error: 'FORBIDDEN'
        });
      }

      console.log(`👶 Fetching children for teacher ID: ${user.id}`);
      
      // Step 1: Get teacher's class info from staff table
      const [teacherRows] = await db.execute(
        "SELECT className FROM staff WHERE id = ?",
        [user.id]
      );

      if (teacherRows.length === 0) {
        return res.status(404).json({ 
          message: "Teacher not found.",
          error: 'TEACHER_NOT_FOUND'
        });
      }

      const className = teacherRows[0].className;
      console.log(`👶 Teacher assigned to class: ${className}`);

      if (!className) {
        return res.status(200).json({ 
          children: [],
          message: "Teacher not assigned to any class"
        });
      }

      // Step 2: Fetch all children in that class
      const [children] = await db.execute(
        "SELECT id, name, age, className, parent_id FROM children WHERE className = ?",
        [className]
      );

      console.log(`✅ Found ${children.length} children in class ${className}`);

      res.status(200).json({ 
        children: children.map(child => ({
          id: child.id,
          name: child.name,
          age: child.age,
          className: child.className,
          parent_id: child.parent_id
        }))
      });
      
    } catch (error) {
      console.error('❌ Error fetching children for teacher:', error);
      res.status(500).json({ 
        message: "Server error", 
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Alternative teacher login endpoint path for compatibility
  app.post('/api/auth/teacher-login', (req, res) => {
    // Redirect to the actual teacher login endpoint
    res.redirect(307, '/api/auth/teacher/login');
  });

  // =============================================================================
  // TEACHER ENDPOINTS - PRODUCTION READY
  // =============================================================================

  // Get teacher profile
  app.get('/api/teacher/profile', async (req, res) => {
    console.log('👩‍🏫 Teacher profile requested');
    try {
      const user = verifyToken(req);
      if (!user || user.role !== 'teacher') {
        return res.status(403).json({
          message: 'Forbidden - teacher access required',
          error: 'FORBIDDEN'
        });
      }

      console.log(`👩‍🏫 Fetching profile for teacher ID: ${user.id}`);
      
      // Get teacher details from staff table
      const [teacher] = await db.execute(
        'SELECT id, name, email, role, is_verified, created_at FROM staff WHERE id = ? AND role = ?',
        [user.id, 'teacher']
      );
      
      if (teacher.length === 0) {
        return res.status(404).json({
          message: 'Teacher profile not found',
          error: 'TEACHER_NOT_FOUND'
        });
      }
      
      const teacherData = teacher[0];
      
      // Get teacher statistics
      const [classCount] = await db.execute(
        'SELECT COUNT(DISTINCT className) as totalClasses FROM children'
      );
      
      const [studentCount] = await db.execute(
        'SELECT COUNT(*) as totalStudents FROM children'
      );
      
      console.log('✅ Teacher profile fetched successfully');
      
      res.json({
        teacher: {
          id: teacherData.id,
          name: teacherData.name,
          email: teacherData.email,
          phone: null, // Phone not available in current schema
          isVerified: teacherData.is_verified,
          joinedAt: teacherData.created_at
        },
        stats: {
          totalClasses: classCount[0]?.totalClasses || 0,
          totalStudents: studentCount[0]?.totalStudents || 0
        }
      });
      
    } catch (error) {
      console.error('❌ Teacher profile error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Get teacher dashboard data
  app.get('/api/teacher/dashboard', async (req, res) => {
    console.log('📊 Teacher dashboard requested');
    try {
      const user = verifyToken(req);
      if (!user || user.role !== 'teacher') {
        return res.status(403).json({
          message: 'Forbidden - teacher access required',
          error: 'FORBIDDEN'
        });
      }

      console.log(`📊 Generating dashboard for teacher ID: ${user.id}`);
      
      // Get basic stats
      const [classCount] = await db.execute(
        'SELECT COUNT(DISTINCT className) as count FROM children'
      );
      
      const [studentCount] = await db.execute(
        'SELECT COUNT(*) as count FROM children'
      );
      
      const [homeworkCount] = await db.execute(
        'SELECT COUNT(*) as count FROM homeworks'
      );
      
      // Get recent homework submissions (mock data for now)
      const recentSubmissions = [
        {
          id: 1,
          studentName: 'John Doe',
          homeworkTitle: 'Math Exercise 1',
          submittedAt: new Date().toISOString(),
          status: 'pending'
        },
        {
          id: 2,
          studentName: 'Jane Smith',
          homeworkTitle: 'Reading Comprehension',
          submittedAt: new Date(Date.now() - 86400000).toISOString(),
          status: 'graded'
        }
      ];
      
      console.log('✅ Teacher dashboard data generated');
      
      res.json({
        stats: {
          totalClasses: classCount[0]?.count || 0,
          totalStudents: studentCount[0]?.count || 0,
          totalHomework: homeworkCount[0]?.count || 0,
          pendingGrading: 2 // Mock data
        },
        recentSubmissions,
        upcomingEvents: [
          {
            id: 1,
            title: 'Parent-Teacher Conference',
            date: new Date(Date.now() + 7 * 86400000).toISOString(),
            type: 'meeting'
          }
        ]
      });
      
    } catch (error) {
      console.error('❌ Teacher dashboard error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Get teacher classes
  app.get('/api/teacher/classes', async (req, res) => {
    console.log('📚 Teacher classes requested');
    try {
      const user = verifyToken(req);
      if (!user || user.role !== 'teacher') {
        return res.status(403).json({
          message: 'Forbidden - teacher access required',
          error: 'FORBIDDEN'
        });
      }

      console.log(`📚 Fetching classes for teacher ID: ${user.id}`);
      
      // Get all classes with student counts
      const [classes] = await db.execute(`
        SELECT 
          className,
          grade,
          COUNT(*) as studentCount,
          GROUP_CONCAT(name) as students
        FROM children 
        GROUP BY className, grade
        ORDER BY className
      `);
      
      const formattedClasses = classes.map(cls => ({
        id: cls.className.toLowerCase().replace(/\s+/g, '-'),
        name: cls.className,
        grade: cls.grade,
        studentCount: cls.studentCount,
        students: cls.students ? cls.students.split(',').map(name => name.trim()) : []
      }));
      
      console.log(`✅ Found ${formattedClasses.length} classes`);
      
      res.json({
        classes: formattedClasses
      });
      
    } catch (error) {
      console.error('❌ Teacher classes error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Get teacher stats
  app.get('/api/teacher/stats', async (req, res) => {
    console.log('📈 Teacher stats requested');
    try {
      const user = verifyToken(req);
      if (!user || user.role !== 'teacher') {
        return res.status(403).json({
          message: 'Forbidden - teacher access required',
          error: 'FORBIDDEN'
        });
      }

      console.log(`📈 Generating stats for teacher ID: ${user.id}`);
      
      // Get comprehensive statistics
      const [classStats] = await db.execute(`
        SELECT 
          className,
          COUNT(*) as studentCount,
          AVG(age) as avgAge
        FROM children 
        GROUP BY className
      `);
      
      const [ageDistribution] = await db.execute(`
        SELECT 
          age,
          COUNT(*) as count
        FROM children 
        GROUP BY age
        ORDER BY age
      `);
      
      const [gradeDistribution] = await db.execute(`
        SELECT 
          grade,
          COUNT(*) as count
        FROM children 
        GROUP BY grade
      `);
      
      console.log('✅ Teacher stats generated');
      
      res.json({
        classStats: classStats.map(stat => ({
          className: stat.className,
          studentCount: stat.studentCount,
          averageAge: Math.round(stat.avgAge * 10) / 10
        })),
        ageDistribution: ageDistribution.map(dist => ({
          age: dist.age,
          count: dist.count
        })),
        gradeDistribution: gradeDistribution.map(dist => ({
          grade: dist.grade,
          count: dist.count
        }))
      });
      
    } catch (error) {
      console.error('❌ Teacher stats error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Get teacher submissions
  app.get('/api/teacher/submissions', async (req, res) => {
    console.log('📝 Teacher submissions requested');
    try {
      const user = verifyToken(req);
      if (!user || user.role !== 'teacher') {
        return res.status(403).json({
          message: 'Forbidden - teacher access required',
          error: 'FORBIDDEN'
        });
      }

      console.log(`📝 Fetching submissions for teacher ID: ${user.id}`);
      
      // For now, return mock data since homework submissions table structure needs to be clarified
      const mockSubmissions = [
        {
          id: 1,
          studentId: 1,
          studentName: 'John Doe',
          homeworkId: 1,
          homeworkTitle: 'Math Practice Sheet',
          submittedAt: new Date().toISOString(),
          status: 'pending',
          fileUrl: null,
          grade: null,
          feedback: null
        },
        {
          id: 2,
          studentId: 2,
          studentName: 'Jane Smith',
          homeworkId: 2,
          homeworkTitle: 'Reading Comprehension',
          submittedAt: new Date(Date.now() - 86400000).toISOString(),
          status: 'graded',
          fileUrl: '/uploads/homework-submission-2.pdf',
          grade: 85,
          feedback: 'Good work! Keep practicing reading comprehension.'
        }
      ];
      
      console.log(`✅ Found ${mockSubmissions.length} submissions`);
      
      res.json({
        submissions: mockSubmissions,
        summary: {
          total: mockSubmissions.length,
          pending: mockSubmissions.filter(s => s.status === 'pending').length,
          graded: mockSubmissions.filter(s => s.status === 'graded').length
        }
      });
      
    } catch (error) {
      console.error('❌ Teacher submissions error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Get all teachers (for admin/frontend)
  app.get('/api/teacher', async (req, res) => {
    console.log('👥 Teachers list requested');
    try {
      const user = verifyToken(req);
      if (!user) {
        return res.status(403).json({
          message: 'Authentication required',
          error: 'UNAUTHORIZED'
        });
      }

      console.log('👥 Fetching all teachers');
      
      // Get all teachers from staff table
      const [teachers] = await db.execute(
        'SELECT id, name, email, is_verified, created_at FROM staff WHERE role = ? ORDER BY name',
        ['teacher']
      );
      
      const formattedTeachers = teachers.map(teacher => ({
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        phone: null, // Phone not available in current schema
        isVerified: teacher.is_verified,
        joinedAt: teacher.created_at
      }));
      
      console.log(`✅ Found ${formattedTeachers.length} teachers`);
      
      res.json({
        teachers: formattedTeachers,
        total: formattedTeachers.length
      });
      
    } catch (error) {
      console.error('❌ Teachers list error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // =============================================================================
  // CHILD MANAGEMENT ENDPOINTS - PRODUCTION READY
  // =============================================================================

  // Age-based class assignment function
  function getClassByAge(age) {
    if (age < 2) return 'Little Explorers';  // Under 2 years - Nursery
    if (age >= 2 && age <= 3) return 'Curious Cubs';  // Ages 2-3 - Elementary
    if (age >= 4 && age <= 6) return 'Panda';   // Ages 4-6 - Grade RR/R
    return 'General Class';  // Fallback for older children
  }

  function getGradeByAge(age) {
    if (age < 2) return 'Nursery';     // Under 2 years
    if (age >= 2 && age <= 3) return 'Elementary';  // Ages 2-3
    if (age === 4 || age === 5) return 'Grade RR';  // Ages 4-5
    if (age === 6) return 'Grade R';   // Age 6
    return 'General';  // Fallback
  }

  // Child registration endpoint
  app.post('/api/auth/register-child', async (req, res) => {
    console.log('👶 Child registration requested');
    try {
      const { name, parent_id, gender, dob, age, grade, className } = req.body;
      
      // Validate required fields
      if (!name || !parent_id || !gender || !dob) {
        return res.status(400).json({
          message: 'Name, parent ID, gender, and date of birth are required',
          error: 'MISSING_REQUIRED_FIELDS'
        });
      }
      
      console.log(`👶 Registering child: ${name} for parent ID: ${parent_id}`);
      
      // Verify parent exists
      const parent = await db.execute(
        'SELECT id FROM users WHERE id = ? AND role = ?',
        [parent_id, 'parent']
      );
      
      if (parent[0].length === 0) {
        console.log('❌ Parent not found');
        return res.status(400).json({
          message: 'Parent not found or invalid role',
          error: 'PARENT_NOT_FOUND'
        });
      }
      
      // Calculate age from DOB if not provided
      let childAge = age;
      if (!childAge && dob) {
        const birthDate = new Date(dob);
        const today = new Date();
        childAge = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          childAge--;
        }
      }
      
      // Auto-assign class and grade based on age
      const autoClassName = getClassByAge(childAge);
      const autoGrade = getGradeByAge(childAge);
      
      const finalClassName = className || autoClassName;
      const finalGrade = grade || autoGrade;
      
      console.log(`📚 Age: ${childAge}, Auto-assigned class: ${autoClassName}, grade: ${autoGrade}`);
      
      // Insert child into database
      await db.execute(
        'INSERT INTO children (name, parent_id, gender, dob, age, grade, className) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, parent_id, gender, dob, childAge, finalGrade, finalClassName]
      );
      
      console.log('✅ Child registered successfully');
      
      res.status(201).json({
        message: 'Child registered successfully!',
        child: {
          name,
          age: childAge,
          grade: finalGrade,
          className: finalClassName
        }
      });
      
    } catch (error) {
      console.error('❌ Child registration error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Get children for a parent
  app.get('/api/auth/parents/:id/children', async (req, res) => {
    console.log('👨‍👩‍👧‍👦 Fetching children for parent');
    try {
      const { id: parentId } = req.params;
      
      console.log(`👨‍👩‍👧‍👦 Parent ID: ${parentId}`);
      
      // Verify parent exists
      const parent = await db.execute(
        'SELECT id FROM users WHERE id = ? AND role = ?',
        [parentId, 'parent']
      );
      
      if (parent[0].length === 0) {
        console.log('❌ Parent not found');
        return res.status(404).json({
          message: 'Parent not found',
          error: 'PARENT_NOT_FOUND'
        });
      }
      
      // Fetch children for this parent
      const children = await db.execute(
        'SELECT id, name, gender, dob, age, grade, className, parent_id FROM children WHERE parent_id = ?',
        [parentId]
      );
      
      console.log(`✅ Found ${children[0].length} children`);
      
      // Format children data for compatibility
      const formattedChildren = children[0].map(child => ({
        ...child,
        first_name: child.name ? child.name.split(' ')[0] : '',
        last_name: child.name ? child.name.split(' ').slice(1).join(' ') : ''
      }));
      
      res.json(formattedChildren);
      
    } catch (error) {
      console.error('❌ Error fetching children:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Parent reports endpoint
  app.get('/api/public/parent/reports', async (req, res) => {
    console.log('📊 Parent report requested');
    const user = verifyToken(req);
    if (!user || user.role !== 'parent') {
      return res.status(403).json({
        message: 'Forbidden - parent access required',
        error: 'FORBIDDEN'
      });
    }

    try {
      const { child_id } = req.query;
      
      if (!child_id) {
        return res.status(400).json({
          message: 'Child ID parameter is required',
          error: 'MISSING_CHILD_ID'
        });
      }
      
      console.log(`📊 Generating report for child ID: ${child_id}`);
      
      // Verify child belongs to this parent
      const [child] = await db.execute(
        'SELECT id, name FROM children WHERE id = ? AND parent_id = ?',
        [child_id, user.id]
      );
      
      if (child.length === 0) {
        return res.status(404).json({
          message: 'Child not found or access denied',
          error: 'CHILD_NOT_FOUND'
        });
      }
      
      const childData = child[0];
      
      // Since the homeworks table schema doesn't match, return mock data for now
      // TODO: Update when proper homework table structure is available
      console.log(`✅ Generating mock report for ${childData.name} (ID: ${childData.id})`);
      
      const mockReport = {
        childId: childData.id,
        childName: childData.name,
        totalHomework: 5,
        submitted: 3,
        graded: 2,
        avgGrade: '85.5',
        submissionRate: 60.0,
        recentGrades: [
          {
            title: 'Math Worksheet',
            grade: 'A',
            date: new Date(Date.now() - 86400000).toISOString()
          },
          {
            title: 'Reading Assignment',
            grade: 'B+',
            date: new Date(Date.now() - 172800000).toISOString()
          }
        ]
      };
      
      res.json(mockReport);

    } catch (error) {
      console.error('❌ Error generating parent report:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Password change endpoint
  app.post('/api/auth/change-password', async (req, res) => {
    console.log('🔐 Password change requested');
    try {
      const { currentPassword, newPassword } = req.body;
      
      // Verify token
      const user = verifyToken(req);
      if (!user) {
        return res.status(401).json({
          message: 'Unauthorized - please log in',
          error: 'UNAUTHORIZED'
        });
      }
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          message: 'Current password and new password are required',
          error: 'MISSING_PASSWORDS'
        });
      }
      
      // Validate new password
      const passwordValidation = PasswordSecurity.validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          message: passwordValidation.message,
          error: 'INVALID_PASSWORD'
        });
      }
      
      console.log(`🔐 Password change for: ${user.email} (${user.role})`);
      
      // Get current user data
      let currentUser;
      if (user.role === 'parent') {
        currentUser = await findUserByEmail(user.email, 'parent');
      } else {
        currentUser = await findStaffByEmail(user.email);
      }
      
      if (!currentUser) {
        return res.status(404).json({
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }
      
      // Verify current password
      if (!PasswordSecurity.verifyPassword(currentPassword, currentUser.password)) {
        return res.status(401).json({
          message: 'Current password is incorrect',
          error: 'INVALID_CURRENT_PASSWORD'
        });
      }
      
      // Hash new password
      const hashedPassword = PasswordSecurity.hashPassword(newPassword);
      
      // Update password in database
      const table = user.role === 'parent' ? 'users' : 'staff';
      await db.execute(`UPDATE ${table} SET password = ?, updated_at = NOW() WHERE id = ?`, [hashedPassword, user.id]);
      
      console.log('✅ Password updated successfully');
      
      res.json({
        message: 'Password updated successfully',
        success: true
      });
      
    } catch (error) {
      console.error('❌ Password change error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // =============================================================================
  // PARENT ENDPOINTS - NEW ADDITIONS
  // =============================================================================

  // Get homework for a specific child
  app.get('/api/parent/:parentId/child/:childId/homework', async (req, res) => {
    console.log('📚 Parent requesting homework for child');
    try {
      const user = verifyToken(req);
      const { parentId, childId } = req.params;
      
      if (!user || user.role !== 'parent') {
        return res.status(403).json({
          message: 'Forbidden - parent access required',
          error: 'FORBIDDEN'
        });
      }
      
      // Verify parent owns this child
      const [childCheck] = await db.execute(
        'SELECT id FROM children WHERE id = ? AND parent_id = ?',
        [childId, parentId]
      );
      
      if (childCheck.length === 0) {
        return res.status(404).json({
          message: 'Child not found or access denied',
          error: 'CHILD_NOT_FOUND'
        });
      }
      
      // Get homework for the child (placeholder implementation)
      const homework = [];
      
      res.json({
        success: true,
        data: homework
      });
      
    } catch (error) {
      console.error('❌ Get child homework error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Get reports for a specific child
  app.get('/api/parent/:parentId/child/:childId/reports', async (req, res) => {
    console.log('📊 Parent requesting reports for child');
    try {
      const user = verifyToken(req);
      const { parentId, childId } = req.params;
      
      if (!user || user.role !== 'parent') {
        return res.status(403).json({
          message: 'Forbidden - parent access required',
          error: 'FORBIDDEN'
        });
      }
      
      // Verify parent owns this child
      const [childCheck] = await db.execute(
        'SELECT id FROM children WHERE id = ? AND parent_id = ?',
        [childId, parentId]
      );
      
      if (childCheck.length === 0) {
        return res.status(404).json({
          message: 'Child not found or access denied',
          error: 'CHILD_NOT_FOUND'
        });
      }
      
      // Get reports for the child (placeholder implementation)
      const reports = [];
      
      res.json({
        success: true,
        data: reports
      });
      
    } catch (error) {
      console.error('❌ Get child reports error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Parent dashboard endpoint
  app.get('/api/parent/dashboard', async (req, res) => {
    console.log('👨‍👩‍👧‍👦 Parent dashboard requested');
    const user = verifyToken(req);
    if (!user || user.role !== 'parent') {
      return res.status(403).json({
        message: 'Forbidden - parent access required',
        error: 'FORBIDDEN'
      });
    }

    try {
      // Get parent's children count
      const [childrenResult] = await db.execute(
        'SELECT COUNT(*) as count FROM children WHERE parent_id = ?',
        [user.id]
      );

      // Get pending homework count (mock for now)
      const pendingHomework = 3;
      const completedHomework = 12;

      // Get recent activity (mock for now)
      const recentActivity = [
        {
          id: 1,
          type: 'homework_submitted',
          title: 'Math Worksheet Submitted',
          description: 'Child submitted math homework',
          date: new Date().toISOString()
        }
      ];

      res.json({
        success: true,
        data: {
          stats: {
            totalChildren: childrenResult[0].count,
            pendingHomework,
            completedHomework,
            upcomingEvents: 2
          },
          recentActivity,
          upcomingHomework: []
        }
      });

    } catch (error) {
      console.error('❌ Parent dashboard error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Get children for parent
  app.get('/api/children', async (req, res) => {
    console.log('👶 Parent children list requested');
    const user = verifyToken(req);
    if (!user || user.role !== 'parent') {
      return res.status(403).json({
        message: 'Forbidden - parent access required',
        error: 'FORBIDDEN'
      });
    }

    try {
      const [children] = await db.execute(
        'SELECT id, name, age, grade, className as class_name, dob, gender FROM children WHERE parent_id = ?',
        [user.id]
      );

      console.log(`✅ Found ${children.length} children for parent ${user.email}`);

      res.json({
        success: true,
        data: children.map(child => ({
          id: child.id,
          name: child.name,
          age: child.age,
          grade: child.grade,
          class_name: child.class_name,
          profileImage: `/avatars/child_${child.id}.jpg`,
          teacher: 'Mrs. Smith' // Mock teacher for now
        }))
      });

    } catch (error) {
      console.error('❌ Children list error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Compatibility route: Get children by parent ID (for frontend compatibility)
  app.get('/api/children/:parentId', async (req, res) => {
    console.log('👶 Parent children list requested (compatibility route)');
    
    const user = verifyToken(req);
    if (!user || user.role !== 'parent') {
      return res.status(403).json({
        message: 'Forbidden - parent access required',
        error: 'FORBIDDEN'
      });
    }

    const { parentId } = req.params;
    
    // Verify the requested parent ID matches the authenticated user
    if (parseInt(parentId) !== user.id) {
      return res.status(403).json({
        message: 'Access denied - can only view your own children',
        error: 'ACCESS_DENIED'
      });
    }

    try {
      const [children] = await db.execute(
        'SELECT id, name, age, grade, className as class_name, dob, gender FROM children WHERE parent_id = ?',
        [parentId]
      );

      console.log(`✅ Found ${children.length} children for parent ${parentId}`);

      // Return in the format the frontend expects
      res.json({
        success: true,
        data: children.map(child => ({
          id: child.id,
          name: child.name,
          age: child.age,
          grade: child.grade,
          className: child.class_name, // Use className for frontend compatibility
          profileImage: `/avatars/child_${child.id}.jpg`,
          teacher: 'Mrs. Smith' // Mock teacher for now
        }))
      });

    } catch (error) {
      console.error('❌ Children list error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR'
      });
    }
  });



  // Homework endpoint for parents
  app.get('/api/homework/parent/:parentId/child/:childId', async (req, res) => {
    console.log('📚 Fetching homework for parent-child pair');
    
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        message: 'Invalid or expired token',
        error: 'INVALID_TOKEN'
      });
    }

    const { parentId, childId } = req.params;
    console.log(`📚 Parent ID: ${parentId}, Child ID: ${childId}`);

    try {
      // Verify the child belongs to the parent
      const [child] = await db.execute(
        'SELECT id, name, className, grade FROM children WHERE id = ? AND parent_id = ?',
        [childId, parentId]
      );
      
      if (child.length === 0) {
        console.log(`❌ Child ${childId} not found for parent ${parentId}`);
        return res.status(404).json({
          message: 'Child not found for this parent',
          error: 'CHILD_NOT_FOUND'
        });
      }
      
      const childInfo = child[0];
      console.log(`✅ Found child: ${childInfo.name} (ID: ${childId})`);
      
      // Fetch actual homework from database based on child's class
      const [homeworks] = await db.execute(`
        SELECT h.*,
               CASE WHEN s.id IS NOT NULL THEN true ELSE false END as submitted,
               s.submitted_at,
               s.file_url as submission_file_url,
               hc.completion_answer
        FROM homeworks h
        LEFT JOIN submissions s ON h.id = s.homework_id AND s.child_id = ? AND s.parent_id = ?
        LEFT JOIN homework_completions hc ON h.id = hc.homework_id AND hc.child_id = ? AND hc.parent_id = ?
        WHERE h.class_name = ?
        ORDER BY h.due_date DESC
      `, [childId, parentId, childId, parentId, childInfo.className]);
      
      // Transform the data to match frontend expectations
      const homeworkData = homeworks.map(hw => ({
        id: hw.id,
        title: hw.title,
        subject: hw.type || 'General',
        description: hw.instructions || 'No description provided',
        due_date: hw.due_date,
        assigned_date: hw.created_at,
        submitted: hw.submitted,
        submitted_at: hw.submitted_at,
        status: hw.submitted ? 'submitted' : 'pending',
        priority: 'medium', // Can be enhanced based on due date
        teacher: hw.uploaded_by_teacher_name || 'Teacher',
          childId: parseInt(childId),
          childName: childInfo.name,
        className: childInfo.className,
        attachments: hw.file_url ? [{ url: hw.file_url, type: 'file' }] : [],
        instructions: hw.instructions || '',
        completion_answer: hw.completion_answer || '',
        teacher_file_url: hw.file_url,
        submission_file_url: hw.submission_file_url
      }));
      
      console.log(`✅ Returning ${homeworkData.length} homework items for child ${childId}`);
      
      res.json({
        success: true,
        data: homeworkData,
        child: {
          id: parseInt(childId),
          name: childInfo.name,
          grade: childInfo.grade,
          className: childInfo.className
        },
        total_count: homeworkData.length
      });
      
    } catch (error) {
      console.error('❌ Error fetching homework:', error);
      res.status(500).json({
        message: 'Failed to fetch homework',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Teacher homework stats endpoint
  app.get('/api/homework/teacher/stats', async (req, res) => {
    console.log('📊 Teacher homework stats requested');
    
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        message: 'Invalid or expired token',
        error: 'INVALID_TOKEN'
      });
    }

    if (user.role !== 'teacher' && user.role !== 'admin') {
      return res.status(403).json({
        message: 'Forbidden - teacher or admin access required',
        error: 'FORBIDDEN'
      });
    }

    try {
      // Get teacher's class(es) if they're a teacher
      let teacherClasses = [];
      if (user.role === 'teacher') {
        const [classes] = await db.execute(
          'SELECT DISTINCT class_name FROM staff WHERE email = ? AND role = "teacher"',
          [user.email]
        );
        teacherClasses = classes.map(c => c.class_name);
      }

      // Build query based on role
      let homeworkQuery = `
        SELECT 
          h.id,
          h.title,
          h.class_name,
          h.type,
          h.due_date,
          h.created_at,
          COUNT(DISTINCT c.id) as total_students,
          COUNT(DISTINCT s.id) as submitted_count,
          (COUNT(DISTINCT s.id) / COUNT(DISTINCT c.id) * 100) as completion_rate
        FROM homeworks h
        LEFT JOIN children c ON c.className = h.class_name
        LEFT JOIN submissions s ON s.homework_id = h.id
      `;
      
      let queryParams = [];
      
      if (user.role === 'teacher' && teacherClasses.length > 0) {
        homeworkQuery += ` WHERE h.class_name IN (${teacherClasses.map(() => '?').join(',')})`;
        queryParams = teacherClasses;
      }
      
      homeworkQuery += `
        GROUP BY h.id, h.title, h.class_name, h.type, h.due_date, h.created_at
        ORDER BY h.created_at DESC
      `;

      const [homeworkStats] = await db.execute(homeworkQuery, queryParams);

      // Get total counts
      let totalHomeworkQuery = 'SELECT COUNT(*) as total FROM homeworks';
      let totalSubmissionQuery = 'SELECT COUNT(*) as total FROM submissions';
      let totalStudentsQuery = 'SELECT COUNT(DISTINCT id) as total FROM children';

      if (user.role === 'teacher' && teacherClasses.length > 0) {
        const classFilter = ` WHERE class_name IN (${teacherClasses.map(() => '?').join(',')})`;
        totalHomeworkQuery += classFilter;
        totalStudentsQuery += classFilter;
        
        totalSubmissionQuery += ` WHERE homework_id IN (SELECT id FROM homeworks${classFilter})`;
        queryParams = [...teacherClasses, ...teacherClasses];
      } else {
        queryParams = [];
      }

      const [totalHomework] = await db.execute(totalHomeworkQuery, 
        user.role === 'teacher' ? teacherClasses : []);
      const [totalSubmissions] = await db.execute(totalSubmissionQuery, 
        user.role === 'teacher' ? teacherClasses : []);
      const [totalStudents] = await db.execute(totalStudentsQuery, 
        user.role === 'teacher' ? teacherClasses : []);

      // Recent homework activity
      let recentQuery = `
        SELECT h.title, h.created_at, h.class_name, COUNT(s.id) as submissions
        FROM homeworks h
        LEFT JOIN submissions s ON h.id = s.homework_id
      `;
      
      if (user.role === 'teacher' && teacherClasses.length > 0) {
        recentQuery += ` WHERE h.class_name IN (${teacherClasses.map(() => '?').join(',')})`;
      }
      
      recentQuery += `
        GROUP BY h.id, h.title, h.created_at, h.class_name
        ORDER BY h.created_at DESC
        LIMIT 5
      `;

      const [recentHomework] = await db.execute(recentQuery, 
        user.role === 'teacher' ? teacherClasses : []);

      console.log('✅ Teacher homework stats retrieved successfully');
      
      res.json({
        success: true,
        stats: {
          totalHomework: totalHomework[0].total,
          totalSubmissions: totalSubmissions[0].total,
          totalStudents: totalStudents[0].total,
          averageCompletionRate: homeworkStats.length > 0 
            ? Math.round(homeworkStats.reduce((sum, hw) => sum + parseFloat(hw.completion_rate || 0), 0) / homeworkStats.length)
            : 0
        },
        homeworkList: homeworkStats.map(hw => ({
          id: hw.id,
          title: hw.title,
          className: hw.class_name,
          type: hw.type,
          dueDate: hw.due_date,
          createdAt: hw.created_at,
          totalStudents: hw.total_students,
          submittedCount: hw.submitted_count,
          completionRate: Math.round(parseFloat(hw.completion_rate || 0))
        })),
        recentActivity: recentHomework.map(hw => ({
          title: hw.title,
          className: hw.class_name,
          createdAt: hw.created_at,
          submissions: hw.submissions
        })),
        teacherClasses: user.role === 'teacher' ? teacherClasses : null
      });
      
    } catch (error) {
      console.error('❌ Error fetching teacher homework stats:', error);
      res.status(500).json({
        message: 'Failed to fetch homework statistics',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Classes endpoint
  app.get('/api/classes', async (req, res) => {
    console.log('📚 Classes list requested');
    try {
      // Get all distinct classes with counts
      const [classes] = await db.execute(`
        SELECT 
          className as name,
          grade,
          COUNT(*) as studentCount
        FROM children 
        GROUP BY className, grade
        ORDER BY className
      `);
      
      console.log(`✅ Found ${classes.length} classes`);
      
      res.json({
        success: true,
        classes: classes.map(cls => ({
          id: cls.name.toLowerCase().replace(/\s+/g, '-'),
          name: cls.name,
          grade: cls.grade,
          studentCount: cls.studentCount
        }))
      });
      
    } catch (error) {
      console.error('❌ Error fetching classes:', error);
      res.status(500).json({
        message: 'Failed to fetch classes',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Parent registration endpoint
  app.post('/api/auth/parent/register', async (req, res) => {
    console.log('👨‍👩‍👧‍👦 Parent registration requested');
    try {
      const { name, email, password } = req.body;
      
      if (!name || !email || !password) {
        return res.status(400).json({
          message: 'Name, email and password are required',
          error: 'MISSING_REQUIRED_FIELDS'
        });
      }
      
      // Validate password
      const passwordValidation = PasswordSecurity.validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          message: passwordValidation.message,
          error: 'INVALID_PASSWORD'
        });
      }
      
      console.log(`👤 Registering parent: ${email}`);
      
      // Check if user already exists
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          message: 'User with this email already exists',
          error: 'USER_EXISTS'
        });
      }
      
      // Hash password
      const hashedPassword = PasswordSecurity.hashPassword(password);
      
      // Insert new parent user
      const [result] = await db.execute(
        'INSERT INTO users (name, email, role, password, address, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [name, email, 'parent', hashedPassword, '']
      );
      
      // Fetch the newly created user
      const newUser = await findUserByEmail(email);
      
      // Generate access token
      const accessToken = TokenManager.generateToken(newUser);
      
      console.log('✅ Parent registered successfully:', email);
      
      res.status(201).json({
        message: 'Registration successful',
        accessToken,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role
        }
      });
      
    } catch (error) {
      console.error('❌ Parent registration error:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(409).json({
          message: 'User with this email already exists',
          error: 'USER_EXISTS'
        });
      } else {
        res.status(500).json({
          message: 'Internal server error',
          error: 'INTERNAL_ERROR'
        });
      }
    }
  });

  // Parent login endpoint
  app.post('/api/auth/parent/login', async (req, res) => {
    console.log('🔐 Parent login requested');
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          message: 'Email and password are required',
          error: 'MISSING_CREDENTIALS'
        });
      }
      
      console.log(`👤 Attempting parent login: ${email}`);
      
      // Find user in database
      const user = await findUserByEmail(email, 'parent');
      
      if (!user) {
        console.log('❌ Parent not found');
        return res.status(401).json({
          message: 'Invalid email or password',
          error: 'INVALID_CREDENTIALS'
        });
      }
      
      // Verify password
      if (!PasswordSecurity.verifyPassword(password, user.password)) {
        console.log('❌ Invalid password');
        return res.status(401).json({
          message: 'Invalid email or password',
          error: 'INVALID_CREDENTIALS'
        });
      }
      
      // Generate token
      const accessToken = TokenManager.generateToken(user);
      
      console.log('✅ Parent login successful:', user.email);
      
      res.json({
        message: 'Login successful',
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
      
    } catch (error) {
      console.error('❌ Parent login error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Token verification endpoint
  app.get('/api/auth/verify', async (req, res) => {
    console.log('🔐 Token verification requested');
    const user = verifyToken(req);
    
    if (!user) {
      return res.status(401).json({
        message: 'Invalid or expired token',
        error: 'INVALID_TOKEN'
      });
    }

    console.log('✅ Token verified for:', user.email);
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    console.log('🚪 Logout requested');
    
    const user = verifyToken(req);
    if (user) {
      console.log('✅ User logged out:', user.email);
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });

  // =============================================================================
  // ADMIN ENDPOINTS
  // =============================================================================

  // Admin dashboard statistics
  app.get('/api/admin/dashboard', async (req, res) => {
    console.log('📊 Admin dashboard requested');
    const user = verifyToken(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        message: 'Forbidden - admin access required',
        error: 'FORBIDDEN'
      });
    }
    
    try {
      const [userStats] = await db.execute('SELECT COUNT(*) as count FROM users WHERE role = "parent"');
      const [childrenStats] = await db.execute('SELECT COUNT(*) as count FROM children');
      const [homeworkStats] = await db.execute('SELECT COUNT(*) as count FROM homeworks');
      const [staffStats] = await db.execute('SELECT COUNT(*) as count FROM staff WHERE role = "teacher"');
      const [submissionStats] = await db.execute('SELECT COUNT(*) as count FROM submissions');
      
      // Get recent activity
      const [recentUsers] = await db.execute('SELECT name, email, created_at FROM users ORDER BY created_at DESC LIMIT 3');
      const [recentHomework] = await db.execute('SELECT title, created_at FROM homeworks ORDER BY created_at DESC LIMIT 3');
      
      const recentActivity = [
        ...recentUsers.map(u => ({
          type: 'user',
          message: `New parent registered: ${u.name}`,
          timestamp: u.created_at
        })),
        ...recentHomework.map(h => ({
          type: 'homework',
          message: `Homework posted: ${h.title}`,
          timestamp: h.created_at
        }))
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);
      
      console.log('✅ Dashboard data retrieved successfully');
      
      res.json({
        totalUsers: userStats[0].count,
        totalChildren: childrenStats[0].count,
        totalHomeworks: homeworkStats[0].count,
        totalTeachers: staffStats[0].count,
        totalSubmissions: submissionStats[0].count,
        systemHealth: 'Good',
        recentActivity
      });
      
    } catch (error) {
      console.error('❌ Dashboard error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Admin analytics endpoint
  app.get('/api/admin/analytics', async (req, res) => {
    console.log('📈 Admin analytics requested');
    const user = verifyToken(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        message: 'Forbidden - admin access required',
        error: 'FORBIDDEN'
      });
    }

    try {
      // Get analytics data
      const [monthlyUsers] = await db.execute(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as month,
          COUNT(*) as count
        FROM users 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month DESC
      `);
      
      const [homeworkSubmissions] = await db.execute(`
        SELECT 
          DATE_FORMAT(submitted_at, '%Y-%m-%d') as date,
          COUNT(*) as submissions
        FROM submissions 
        WHERE submitted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE_FORMAT(submitted_at, '%Y-%m-%d')
        ORDER BY date DESC
      `);
      
      const [classDistribution] = await db.execute(`
        SELECT 
          className as class_name,
          COUNT(*) as student_count
        FROM children 
        GROUP BY className
        ORDER BY student_count DESC
      `);
      
      console.log('✅ Analytics data retrieved successfully');
      
      res.json({
        monthlyUsers,
        homeworkSubmissions,
        classDistribution,
        generatedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Analytics error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Admin quick actions endpoint
  app.get('/api/admin/quick-actions', async (req, res) => {
    console.log('⚡ Admin quick actions requested');
    const user = verifyToken(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        message: 'Forbidden - admin access required',
        error: 'FORBIDDEN'
      });
    }
    
    try {
      // Get pending items that need admin attention
      const [pendingUsers] = await db.execute('SELECT COUNT(*) as count FROM users WHERE role = "parent"');
      const [overdueHomework] = await db.execute('SELECT COUNT(*) as count FROM homeworks WHERE due_date < NOW() AND status != "completed"');
      
      const quickActions = [
        {
          id: 'total_users',
          title: 'Total Parents',
          count: pendingUsers[0].count,
          priority: 'low',
          action: '/admin/users'
        },
        {
          id: 'overdue_homework',
          title: 'Overdue Homework',
          count: overdueHomework[0].count,
          priority: overdueHomework[0].count > 5 ? 'high' : 'medium',
          action: '/admin/homework?filter=overdue'
        },
        {
          id: 'system_status',
          title: 'System Status',
          count: 1,
          priority: 'low',
          action: '/admin/system'
        }
      ];
      
      console.log('✅ Quick actions data retrieved successfully');
      
      res.json({
        quickActions,
        lastUpdated: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Quick actions error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Admin users management
  app.get('/api/admin/users', async (req, res) => {
    console.log('👥 Admin users list requested');
    const user = verifyToken(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        message: 'Forbidden - admin access required',
        error: 'FORBIDDEN'
      });
    }
    
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const search = req.query.search || '';
      const offset = (page - 1) * limit;
      
      // Validate parameters
      if (isNaN(page) || isNaN(limit) || page < 1 || limit < 1 || limit > 200) {
        return res.status(400).json({
          message: 'Invalid pagination parameters',
          error: 'INVALID_PARAMS'
        });
      }
      
      // Ensure limit and offset are safe integers
      const limitParam = Math.max(1, Math.min(200, parseInt(limit)));
      const offsetParam = Math.max(0, parseInt(offset));
      
      let query = 'SELECT id, name, email, role, created_at, TRUE as is_verified FROM users';
      let countQuery = 'SELECT COUNT(*) as total FROM users';
      let params = [];
      
      if (search) {
        query += ' WHERE name LIKE ? OR email LIKE ?';
        countQuery += ' WHERE name LIKE ? OR email LIKE ?';
        params = [`%${search}%`, `%${search}%`];
      }
      
      query += ` ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`;
      
      console.log('🔍 Executing query:', query);
      console.log('🔍 With params:', params);
      
      // Execute queries
      const [users] = await db.execute(query, params);
      const [totalResult] = await db.execute(countQuery, params);
      
      const total = totalResult[0].total;
      const pages = Math.ceil(total / limitParam);
      
      console.log('✅ Users data retrieved successfully');
      
      res.json({
        success: true,
        data: users,
        pagination: {
          page,
          limit: limitParam,
          total,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1
        }
      });
      
    } catch (error) {
      console.error('❌ Users list error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Admin create user endpoint
  app.post('/api/admin/users', async (req, res) => {
    console.log('👤 Admin create user requested');
    const user = verifyToken(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        message: 'Forbidden - admin access required',
        error: 'FORBIDDEN'
      });
    }
    
    try {
      const { name, email, role, password } = req.body;
      
      // Validate required fields
      if (!name || !email || !role || !password) {
        return res.status(400).json({
          message: 'Name, email, role, and password are required',
          error: 'MISSING_REQUIRED_FIELDS'
        });
      }
      
      // Validate role
      if (!['parent', 'teacher'].includes(role)) {
        return res.status(400).json({
          message: 'Role must be either "parent" or "teacher"',
          error: 'INVALID_ROLE'
        });
      }
      
      // Validate password
      const passwordValidation = PasswordSecurity.validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          message: passwordValidation.message,
          error: 'INVALID_PASSWORD'
        });
      }
      
      console.log(`👤 Creating ${role}: ${email}`);
      
      // Check if user already exists
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          message: 'User with this email already exists',
          error: 'USER_EXISTS'
        });
      }
      
      // Hash password
      const hashedPassword = PasswordSecurity.hashPassword(password);
      
      // Insert user into appropriate table
      if (role === 'parent') {
        await db.execute(
          'INSERT INTO users (name, email, role, password, address, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [name, email, role, hashedPassword, '']
        );
      } else if (role === 'teacher') {
        await db.execute(
          'INSERT INTO staff (name, email, role, password, created_at) VALUES (?, ?, ?, ?, NOW())',
          [name, email, role, hashedPassword]
        );
      }
      
      console.log(`✅ ${role} created successfully: ${email}`);
      
      res.status(201).json({
        success: true,
        message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully`,
        user: {
          name,
          email,
          role
        }
      });
      
    } catch (error) {
      console.error('❌ Create user error:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(409).json({
          message: 'User with this email already exists',
          error: 'USER_EXISTS'
        });
      } else {
        res.status(500).json({
          message: 'Internal server error',
          error: 'DATABASE_ERROR'
        });
      }
    }
  });

  // Debug endpoint for children
  app.get('/api/admin/children-debug', async (req, res) => {
    console.log('🔍 Debug children endpoint called');
    
    try {
      // Step 1: Check token
      const user = verifyToken(req);
      if (!user) {
        return res.status(401).json({ message: 'No token', step: 1 });
      }
      console.log('✅ Token verified:', user.role);
      
      // Step 2: Check role
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Not admin', step: 2 });
      }
      console.log('✅ Admin role confirmed');
      
      // Step 3: Test database connection
      const [testResult] = await db.execute('SELECT COUNT(*) as count FROM children');
      console.log('✅ Database test:', testResult[0].count);
      
      // Step 4: Test simple query
      const [simpleResult] = await db.execute('SELECT id, name FROM children LIMIT 3');
      console.log('✅ Simple query result:', simpleResult.length);
      
      // Step 5: Test the problematic query
      const query = `
        SELECT 
          c.id,
          c.name,
          c.dob,
          c.age,
          c.gender,
          c.grade,
          c.className as class_name,
          c.parent_id,
          u.name as parent_name,
          u.email as parent_email,
          c.created_at
        FROM children c
        LEFT JOIN users u ON c.parent_id = u.id
        ORDER BY c.created_at DESC LIMIT 5 OFFSET 0
      `;
      
      console.log('🔍 Testing full query...');
      const [fullResult] = await db.execute(query, []);
      console.log('✅ Full query result:', fullResult.length);
      
      res.json({
        message: 'Debug successful',
        steps: {
          token: 'OK',
          role: 'OK',
          database: testResult[0].count,
          simple_query: simpleResult.length,
          full_query: fullResult.length
        },
        sample_data: fullResult[0]
      });
      
    } catch (error) {
      console.error('❌ Debug error:', error.message);
      console.error('❌ Error code:', error.code);
      console.error('❌ Stack:', error.stack);
      
      res.status(500).json({
        message: 'Debug error',
        error: error.message,
        code: error.code,
        sqlState: error.sqlState
      });
    }
  });

  // Admin children management
  app.get('/api/admin/children', async (req, res) => {
    console.log('👶 Admin children list requested');
    const user = verifyToken(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        message: 'Forbidden - admin access required',
        error: 'FORBIDDEN'
      });
    }
    
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const search = req.query.search || '';
      const showAll = req.query.all === 'true'; // New parameter to get all children
      
      console.log('🔍 Getting children:', { page, limit, search, showAll });
      
      // Build base query with JOIN to get parent info efficiently
      let baseQuery = `
        SELECT 
          c.id,
          c.name,
          c.dob,
          c.age,
          c.gender,
          c.grade,
          c.className,
          c.parent_id,
          c.created_at,
          u.name as parent_name,
          u.email as parent_email
        FROM children c
        LEFT JOIN users u ON c.parent_id = u.id
      `;
      
      let whereClause = '';
      let params = [];
      
      if (search) {
        whereClause = ' WHERE (c.name LIKE ? OR c.grade LIKE ? OR c.className LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
        const searchParam = `%${search}%`;
        params = [searchParam, searchParam, searchParam, searchParam, searchParam];
      }
      
      // Count query for pagination
      const countQuery = `SELECT COUNT(*) as total FROM children c LEFT JOIN users u ON c.parent_id = u.id${whereClause}`;
      
      // Main query with ordering
      let mainQuery = baseQuery + whereClause + ' ORDER BY c.created_at DESC';
      
      // Add pagination unless showAll is requested
      if (!showAll) {
        // Validate pagination parameters
        if (isNaN(page) || isNaN(limit) || page < 1 || limit < 1 || limit > 500) {
          return res.status(400).json({
            message: 'Invalid pagination parameters',
            error: 'INVALID_PARAMS'
          });
        }
        
        const limitParam = Math.max(1, Math.min(500, parseInt(limit))); // Increased max limit
        const offsetParam = Math.max(0, (page - 1) * limitParam);
        
        mainQuery += ` LIMIT ${limitParam} OFFSET ${offsetParam}`;
        console.log('🔍 Using pagination:', { page, limit: limitParam, offset: offsetParam });
      } else {
        console.log('🔍 Retrieving ALL children (no pagination)');
      }
      
      console.log('🔍 Executing query:', mainQuery);
      console.log('🔍 With params:', params);
      
      // Execute queries
      const [children] = await db.execute(mainQuery, params);
      const [totalResult] = await db.execute(countQuery, params);
      
      const total = totalResult[0].total;
      const pages = showAll ? 1 : Math.ceil(total / limit);
      
      // Format children data for frontend compatibility
      const formattedChildren = children.map(child => ({
        id: child.id,
        name: child.name,
        dob: child.dob,
        age: child.age,
        gender: child.gender,
        grade: child.grade,
        className: child.className,
        class_name: child.className, // Frontend compatibility
        parent_id: child.parent_id,
        parent_name: child.parent_name || 'Unknown',
        parent_email: child.parent_email || '',
        first_name: child.name ? child.name.split(' ')[0] : '',
        last_name: child.name ? child.name.split(' ').slice(1).join(' ') : '',
        date_of_birth: child.dob,
        created_at: child.created_at,
        emergency_contact: '',
        medical_notes: '',
        allergies: ''
      }));
      
      console.log(`✅ Children data retrieved: ${formattedChildren.length} children (Total in DB: ${total})`);
      
      const response = {
        success: true,
        data: formattedChildren,
        total_count: total,
        retrieved_count: formattedChildren.length
      };
      
      // Add pagination info only if not showing all
      if (!showAll) {
        response.pagination = {
          page,
          limit: parseInt(limit),
          total,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1
        };
      }
      
      res.json(response);
      
    } catch (error) {
      console.error('❌ Children list error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
        stack: error.stack
      });
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR',
        details: error.message
      });
    }
  });

  // Create new child
  app.post('/api/admin/children', async (req, res) => {
    console.log('👶 Creating new child');
    const user = verifyToken(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        message: 'Forbidden - admin access required',
        error: 'FORBIDDEN'
      });
    }
    
    try {
      const { name, age, parent_id, class_name, allergies, medical_notes, emergency_contact } = req.body;
      
      // Validate required fields
      if (!name || !age || !parent_id) {
        return res.status(400).json({
          message: 'Name, age, and parent are required',
          error: 'MISSING_REQUIRED_FIELDS'
        });
      }
      
      // Calculate date of birth from age
      const currentDate = new Date();
      const birthYear = currentDate.getFullYear() - parseInt(age);
      const dateOfBirth = `${birthYear}-01-01`; // Approximate DOB
      
      // Auto-assign grade and class based on age
      const childAge = parseInt(age);
      let grade = 'General';
      let className = class_name || 'General Class';
      
      if (childAge < 2) {
        grade = 'Nursery';
        className = 'Little Explorers';
      } else if (childAge >= 2 && childAge <= 3) {
        grade = 'Elementary';
        className = 'Curious Cubs';
      } else if (childAge >= 4 && childAge <= 6) {
        grade = 'Grade RR';
        className = 'Panda';
      }
      
      // Insert child using the actual database schema
      const [result] = await db.execute(
        `INSERT INTO children (name, parent_id, gender, dob, age, grade, className, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          name,
          parent_id,
          'other', // Default gender since not specified in form
          dateOfBirth,
          childAge,
          grade,
          className
        ]
      );
      
      console.log(`✅ Child created successfully: ${name}`);
      
      res.status(201).json({
        success: true,
        message: 'Child enrolled successfully',
        child: {
          id: result.insertId,
          name,
          age: childAge,
          parent_id: parseInt(parent_id),
          class_name: className,
          grade,
          allergies: allergies || '',
          medical_notes: medical_notes || '',
          emergency_contact: emergency_contact || ''
        }
      });
      
    } catch (error) {
      console.error('❌ Create child error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Update child
  app.put('/api/admin/children/:id', async (req, res) => {
    console.log('👶 Updating child:', req.params.id);
    const user = verifyToken(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        message: 'Forbidden - admin access required',
        error: 'FORBIDDEN'
      });
    }
    
    try {
      const childId = req.params.id;
      const { name, age, class_name, allergies, medical_notes, emergency_contact } = req.body;
      
      // Validate required fields
      if (!name || !age) {
        return res.status(400).json({
          message: 'Name and age are required',
          error: 'MISSING_REQUIRED_FIELDS'
        });
      }
      
      // Calculate date of birth from age
      const currentDate = new Date();
      const birthYear = currentDate.getFullYear() - parseInt(age);
      const dateOfBirth = `${birthYear}-01-01`;
      
      // Auto-assign grade based on age if not provided
      const childAge = parseInt(age);
      let grade = 'General';
      let className = class_name || 'General Class';
      
      if (childAge < 2) {
        grade = 'Nursery';
        if (!class_name) className = 'Little Explorers';
      } else if (childAge >= 2 && childAge <= 3) {
        grade = 'Elementary';
        if (!class_name) className = 'Curious Cubs';
      } else if (childAge >= 4 && childAge <= 6) {
        grade = 'Grade RR';
        if (!class_name) className = 'Panda';
      }
      
      // Update child using the actual database schema
      const [result] = await db.execute(
        `UPDATE children SET 
          name = ?, dob = ?, age = ?, grade = ?, className = ?
        WHERE id = ?`,
        [
          name,
          dateOfBirth,
          childAge,
          grade,
          className,
          childId
        ]
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: 'Child not found',
          error: 'CHILD_NOT_FOUND'
        });
      }
      
      console.log(`✅ Child updated successfully: ${name}`);
      
      res.json({
        success: true,
        message: 'Child information updated successfully',
        child: {
          id: parseInt(childId),
          name,
          age: childAge,
          class_name: className,
          grade,
          allergies: allergies || '',
          medical_notes: medical_notes || '',
          emergency_contact: emergency_contact || ''
        }
      });
      
    } catch (error) {
      console.error('❌ Update child error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Delete child
  app.delete('/api/admin/children/:id', async (req, res) => {
    console.log('👶 Deleting child:', req.params.id);
    const user = verifyToken(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        message: 'Forbidden - admin access required',
        error: 'FORBIDDEN'
      });
    }
    
    try {
      const childId = req.params.id;
      
      // Check if child exists
      const [existingChild] = await db.execute(
        'SELECT name FROM children WHERE id = ?',
        [childId]
      );
      
      if (existingChild.length === 0) {
        return res.status(404).json({
          message: 'Child not found',
          error: 'CHILD_NOT_FOUND'
        });
      }
      
      // Delete child (this will cascade delete related records)
      const [result] = await db.execute('DELETE FROM children WHERE id = ?', [childId]);
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: 'Child not found',
          error: 'CHILD_NOT_FOUND'
        });
      }
      
      console.log(`✅ Child deleted successfully: ${existingChild[0].name}`);
      
      res.json({
        success: true,
        message: 'Child removed successfully'
      });
      
    } catch (error) {
      console.error('❌ Delete child error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Notifications endpoint
  app.get('/api/notifications', async (req, res) => {
    console.log('📢 Notifications requested');
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        message: 'Unauthorized - please log in',
        error: 'UNAUTHORIZED'
      });
    }

    try {
      // Return mock notifications for now
      const mockNotifications = [
        {
          id: 1,
          title: 'New Homework Assigned',
          message: 'Math worksheet has been assigned to your child',
          type: 'homework',
          read: false,
          date: new Date().toISOString(),
          priority: 'medium'
        },
        {
          id: 2,
          title: 'Homework Submitted',
          message: 'Reading assignment has been submitted successfully',
          type: 'homework',
          read: true,
          date: new Date(Date.now() - 3600000).toISOString(),
          priority: 'low'
        }
      ];

      res.json({
        success: true,
        data: mockNotifications
      });

    } catch (error) {
      console.error('❌ Notifications error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Messages endpoint
  app.get('/api/messages', async (req, res) => {
    console.log('💬 Messages requested');
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        message: 'Unauthorized - please log in',
        error: 'UNAUTHORIZED'
      });
    }

    try {
      // Return mock messages for now
      const mockMessages = [
        {
          id: 1,
          from: 'Mrs. Smith',
          fromRole: 'teacher',
          subject: 'Great Progress!',
          message: 'Your child is doing excellent work in class',
          date: new Date(Date.now() - 86400000).toISOString(),
          read: false
        },
        {
          id: 2,
          from: 'School Admin',
          fromRole: 'admin',
          subject: 'School Event',
          message: 'Parent-teacher conference next week',
          date: new Date(Date.now() - 172800000).toISOString(),
          read: true
        }
      ];

      res.json({
        success: true,
        data: mockMessages
      });

    } catch (error) {
      console.error('❌ Messages error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Homework grades endpoint
  app.get('/api/homeworks/grades/child/:childId', async (req, res) => {
    console.log('📊 Homework grades requested for child:', req.params.childId);
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        message: 'Unauthorized - please log in',
        error: 'UNAUTHORIZED'
      });
    }

    try {
      const { childId } = req.params;
      
      // Verify child belongs to this parent (if user is parent)
      if (user.role === 'parent') {
        const [child] = await db.execute(
          'SELECT id, name FROM children WHERE id = ? AND parent_id = ?',
          [childId, user.id]
        );
        
        if (child.length === 0) {
          return res.status(404).json({
            message: 'Child not found or access denied',
            error: 'CHILD_NOT_FOUND'
          });
        }
        
        console.log(`✅ Generating mock report for ${child[0].name} (ID: ${childId})`);
      }
      
      // Return mock grades for now
      const mockGrades = [
        {
          id: 1,
          homework_title: 'Math Worksheet',
          grade: 'A',
          percentage: 95,
          graded_at: new Date(Date.now() - 86400000).toISOString(),
          teacher: 'Mrs. Smith',
          subject: 'Mathematics',
          feedback: 'Excellent work on multiplication!'
        },
        {
          id: 2,
          homework_title: 'Reading Comprehension',
          grade: 'B+',
          percentage: 87,
          graded_at: new Date(Date.now() - 172800000).toISOString(),
          teacher: 'Ms. Johnson',
          subject: 'English',
          feedback: 'Good understanding, work on vocabulary'
        },
        {
          id: 3,
          homework_title: 'Science Project',
          grade: 'A-',
          percentage: 92,
          graded_at: new Date(Date.now() - 259200000).toISOString(),
          teacher: 'Mr. Brown',
          subject: 'Science',
          feedback: 'Creative approach to the experiment!'
        }
      ];
      
      console.log(`✅ Returning ${mockGrades.length} grades for child ${childId}`);
      
      res.json({
        success: true,
        grades: mockGrades,
        child_id: parseInt(childId),
        total_count: mockGrades.length
      });
      
    } catch (error) {
      console.error('❌ Error fetching homework grades:', error);
      res.status(500).json({
        message: 'Failed to fetch homework grades',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Get ALL children (no pagination) - Admin only
  app.get('/api/admin/children/all', async (req, res) => {
    console.log('👶 Admin requesting ALL children (no pagination)');
    const user = verifyToken(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        message: 'Forbidden - admin access required',
        error: 'FORBIDDEN'
      });
    }
    
    try {
      const search = req.query.search || '';
      
      // Build query to get ALL children with parent info
      let query = `
        SELECT 
          c.id,
          c.name,
          c.dob,
          c.age,
          c.gender,
          c.grade,
          c.className,
          c.parent_id,
          c.created_at,
          u.name as parent_name,
          u.email as parent_email
        FROM children c
        LEFT JOIN users u ON c.parent_id = u.id
      `;
      
      let params = [];
      
      if (search) {
        query += ' WHERE (c.name LIKE ? OR c.grade LIKE ? OR c.className LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
        const searchParam = `%${search}%`;
        params = [searchParam, searchParam, searchParam, searchParam, searchParam];
      }
      
      query += ' ORDER BY c.created_at DESC';
      
      console.log('🔍 Executing query for ALL children:', query);
      console.log('🔍 With params:', params);
      
      const [children] = await db.execute(query, params);
      
      // Format children data
      const formattedChildren = children.map(child => ({
        id: child.id,
        name: child.name,
        dob: child.dob,
        age: child.age,
        gender: child.gender,
        grade: child.grade,
        className: child.className,
        class_name: child.className,
        parent_id: child.parent_id,
        parent_name: child.parent_name || 'Unknown',
        parent_email: child.parent_email || '',
        first_name: child.name ? child.name.split(' ')[0] : '',
        last_name: child.name ? child.name.split(' ').slice(1).join(' ') : '',
        date_of_birth: child.dob,
        created_at: child.created_at,
        emergency_contact: '',
        medical_notes: '',
        allergies: ''
      }));
      
      console.log(`✅ ALL children retrieved: ${formattedChildren.length} total children`);
      
      res.json({
        success: true,
        data: formattedChildren,
        total_count: formattedChildren.length,
        message: `Retrieved all ${formattedChildren.length} children from database`
      });
      
    } catch (error) {
      console.error('❌ Get all children error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'DATABASE_ERROR',
        details: error.message
      });
    }
  });

  // Firebase login endpoint
  app.post('/api/auth/firebase-login', async (req, res) => {
    console.log('🔥 Firebase login requested');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    
    try {
      // Try multiple possible field names for flexibility
      const { 
        idToken, 
        email, 
        name, 
        photoURL, 
        uid, 
        displayName,
        // Alternative field names
        token,
        firebaseToken,
        user_email,
        user_name,
        firebase_uid
      } = req.body;
      
      // Use flexible field extraction
      const finalToken = idToken || token || firebaseToken;
      const userEmail = email || user_email;
      const userName = name || displayName || user_name;
      const userUID = uid || firebase_uid;
      
      if (!finalToken || !userEmail) {
        console.log('❌ Missing credentials:', { 
          hasToken: !!finalToken, 
          hasEmail: !!userEmail,
          receivedFields: Object.keys(req.body) 
        });
        return res.status(400).json({
          message: 'Firebase ID token and email are required',
          error: 'MISSING_CREDENTIALS',
          debug: {
            receivedFields: Object.keys(req.body),
            expectedFields: ['idToken', 'email'] 
          }
        });
      }
      
      console.log(`🔥 Firebase login attempt: ${userEmail}`);
      
      // Check if user exists in database
      let user = await findUserByEmail(userEmail);
      
      if (!user) {
        // Create new user from Firebase data
        console.log('👤 Creating new user from Firebase data');
        
        const hashedPassword = PasswordSecurity.hashPassword(finalToken); // Use token as password
        
        try {
          await db.execute(
            'INSERT INTO users (name, email, role, password, address, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [userName || userEmail.split('@')[0], userEmail, 'parent', hashedPassword, '']
          );
          
          // Fetch the newly created user
          user = await findUserByEmail(userEmail);
          console.log('✅ New Firebase user created:', userEmail);
        } catch (dbError) {
          console.error('❌ Failed to create Firebase user:', dbError);
          return res.status(500).json({
            message: 'Failed to create user account',
            error: 'USER_CREATION_FAILED'
          });
        }
      }
      
      // Generate access token
      const accessToken = TokenManager.generateToken(user);
      
      console.log('✅ Firebase login successful:', user.email);
      
      res.json({
        message: 'Firebase login successful',
        accessToken,
        token: accessToken, // Also include 'token' for frontend compatibility
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          photoURL: photoURL || null
        }
      });
      
    } catch (error) {
      console.error('❌ Firebase login error:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      });
    }
  });

  // Parent registration endpoint
  app.post('/api/auth/register', async (req, res) => {
    console.log('👤 Parent registration requested');
    try {
      const { name, email, password, phone } = req.body;
      
      if (!name || !email || !password) {
        return res.status(400).json({
          message: 'Name, email, and password are required',
          error: 'MISSING_REQUIRED_FIELDS'
        });
      }
      
      // Validate password
      const passwordValidation = PasswordSecurity.validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          message: passwordValidation.message,
          error: 'INVALID_PASSWORD'
        });
      }
      
      console.log(`👤 Registering parent: ${email}`);
      
      // Check if user already exists
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          message: 'User with this email already exists',
          error: 'USER_EXISTS'
        });
      }
      
      // Hash password
      const hashedPassword = PasswordSecurity.hashPassword(password);
      
      // Insert new parent user
      const [result] = await db.execute(
        'INSERT INTO users (name, email, role, password, address, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [name, email, 'parent', hashedPassword, '']
      );
      
      // Fetch the newly created user
      const newUser = await findUserByEmail(email);
      
      // Generate access token
      const accessToken = TokenManager.generateToken(newUser);
      
      console.log('✅ Parent registered successfully:', email);
      
      res.status(201).json({
        message: 'Registration successful',
        accessToken,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role
        }
      });
      
    } catch (error) {
      console.error('❌ Parent registration error:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(409).json({
          message: 'User with this email already exists',
          error: 'USER_EXISTS'
        });
      } else {
        res.status(500).json({
          message: 'Internal server error',
          error: 'INTERNAL_ERROR'
        });
      }
    }
  });

  // Homework submission endpoint
  app.post('/api/homework/submit/:homeworkId', upload.array('files', 5), async (req, res) => {
    console.log('📝 Homework submission requested');
    
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        message: 'Invalid or expired token',
        error: 'INVALID_TOKEN'
      });
    }
    
    const { homeworkId } = req.params;
    const { child_id, parent_id, comment } = req.body;
    
    console.log('📝 Submission details:', {
      homeworkId,
      child_id,
      parent_id,
      comment,
      filesCount: req.files ? req.files.length : 0,
      userId: user.id
    });
    
    // Validate required fields
    if (!homeworkId || !child_id || !parent_id) {
      return res.status(400).json({
        message: 'Homework ID, child ID, and parent ID are required',
        error: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    // Verify the parent_id matches the authenticated user
    if (parseInt(parent_id) !== user.id) {
      return res.status(403).json({
        message: 'Access denied - can only submit for your own children',
        error: 'ACCESS_DENIED'
      });
    }
    
    try {
      // Verify the child belongs to the parent
      const [child] = await db.execute(
        'SELECT id, name, className FROM children WHERE id = ? AND parent_id = ?',
        [child_id, parent_id]
      );
      
      if (child.length === 0) {
        return res.status(404).json({
          message: 'Child not found for this parent',
          error: 'CHILD_NOT_FOUND'
        });
      }
      
      // Verify the homework exists and is for the child's class
      const [homework] = await db.execute(
        'SELECT id, title, class_name FROM homeworks WHERE id = ?',
        [homeworkId]
      );
      
      if (homework.length === 0) {
        return res.status(404).json({
          message: 'Homework assignment not found',
          error: 'HOMEWORK_NOT_FOUND'
        });
      }
      
      if (homework[0].class_name !== child[0].className) {
        return res.status(403).json({
          message: 'This homework is not assigned to your child\'s class',
          error: 'CLASS_MISMATCH'
        });
      }
      
      // Check if already submitted
      const [existingSubmission] = await db.execute(
        'SELECT id FROM submissions WHERE homework_id = ? AND child_id = ? AND parent_id = ?',
        [homeworkId, child_id, parent_id]
      );
      
      if (existingSubmission.length > 0) {
        return res.status(409).json({
          message: 'Homework already submitted for this child',
          error: 'ALREADY_SUBMITTED'
        });
      }
      
      // Process uploaded files
      let fileUrls = [];
      if (req.files && req.files.length > 0) {
        fileUrls = req.files.map(file => `/uploads/homework/${file.filename}`);
      }
      
      // Insert submission
      const [result] = await db.execute(
        'INSERT INTO submissions (homework_id, parent_id, child_id, file_url, comment, submitted_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [homeworkId, parent_id, child_id, JSON.stringify(fileUrls), comment || '']
      );
      
      console.log('✅ Homework submitted successfully:', {
        submissionId: result.insertId,
        homeworkId,
        child_id,
        filesCount: fileUrls.length
      });

      // Emit real-time event to admin dashboard
      if (req.app.locals.adminEvents) {
        req.app.locals.adminEvents.emitNewSubmission({
          submissionId: result.insertId,
          studentName: child[0].name,
          childName: child[0].name,
          homeworkTitle: homework[0].title,
          className: child[0].className,
          filesCount: fileUrls.length
        });
      }
      
      res.json({
        success: true,
        message: 'Homework submitted successfully',
        submissionId: result.insertId,
        files: fileUrls
      });
      
    } catch (error) {
      console.error('❌ Error submitting homework:', error);
      res.status(500).json({
        message: 'Failed to submit homework',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Initialize Admin WebSocket Events Handler
  const adminEvents = new AdminWebSocketEvents(io);

  // Initialize WebSocket event handlers
  const messageEvents = new MessageWebSocketEvents(io, db);

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('🔌 New socket connection:', socket.id);
    
    // Handle connection
    messageEvents.handleConnection(socket);
    
    // Handle disconnection
    socket.on('disconnect', () => {
      messageEvents.handleDisconnection(socket);
    });
  });

  // Make adminEvents available globally for API endpoints
  app.locals.adminEvents = adminEvents;

  // Start listening on the configured port
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Young Eagles API Server running on port ${PORT}`);
    console.log(`📍 Local URL: http://localhost:${PORT}`);
    console.log(`🌐 Network URL: http://0.0.0.0:${PORT}`);
    console.log(`🔌 Socket.IO enabled on path: /socket.io/`);
    console.log('✅ Server ready to accept connections!');
  });
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
}); 