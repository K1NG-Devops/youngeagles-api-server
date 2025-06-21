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
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "# LOCALHOST_REMOVED_FOR_SECURITY", 
      "# LOCALHOST_REMOVED_FOR_SECURITY", 
      "# LOCALHOST_REMOVED_FOR_SECURITY", 
      "https://youngeagles.org.za",
      "https://www.youngeagles.org.za",
      "https://youngeagles-app.vercel.app",
      "https://youngeagles-pwa.vercel.app",
      "https://young-eagles-pwa.vercel.app",
      // Allow any Vercel domain
      /^https:\/\/.*\.vercel\.app$/,
      // Allow any localhost
      /^http:\/\/localhost:\d+$/
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;

// Database configuration
const dbConfig = {
  host: 'shuttle.proxy.rlwy.net',
  port: 49263,
  user: 'root',
  password: 'fhdgRvbocRQKcikxGTNsQUHVIMizngLb',
  database: 'skydek_DB',
  ssl: false,
  connectionLimit: 10,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

let db;

// Initialize database connection
async function initDatabase() {
  try {
    db = mysql.createPool(dbConfig);
    const connection = await db.getConnection();
    connection.release();
    return true;
  } catch (error) {
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
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      return { 
        valid: false, 
        message: 'Password must contain uppercase, lowercase, numbers, and special characters' 
      };
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
    
    const secret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
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
      
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      
      return payload;
    } catch (error) {
      return null;
    }
  }
}

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      '# LOCALHOST_REMOVED_FOR_SECURITY',
      '# LOCALHOST_REMOVED_FOR_SECURITY', 
      '# LOCALHOST_REMOVED_FOR_SECURITY',
      'https://youngeagles.org.za',
      'https://www.youngeagles.org.za',
      'https://youngeagles-app.vercel.app',
      'https://youngeagles-pwa.vercel.app',
      'https://young-eagles-pwa.vercel.app',
      // Allow any Vercel deployment
      /^https:\/\/.*\.vercel\.app$/,
      // Allow any localhost for development
      /^http:\/\/localhost:\d+$/
    ];
    
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin', 'X-Requested-With', 'Content-Type', 'Accept', 
    'Authorization', 'Cache-Control', 'Pragma', 'Expires'
  ]
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Custom CORS middleware for additional flexibility
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // List of allowed origins
  const allowedOrigins = [
    '# LOCALHOST_REMOVED_FOR_SECURITY',
    '# LOCALHOST_REMOVED_FOR_SECURITY', 
    '# LOCALHOST_REMOVED_FOR_SECURITY',
    'https://youngeagles.org.za',
    'https://www.youngeagles.org.za',
    'https://youngeagles-app.vercel.app',
    'https://youngeagles-pwa.vercel.app',
    'https://young-eagles-pwa.vercel.app'
  ];
  
  // Check if origin is allowed or matches patterns
  if (origin) {
    const isAllowed = allowedOrigins.includes(origin) || 
                     /^https:\/\/.*\.vercel\.app$/.test(origin) ||
                     /^http:\/\/localhost:\d+$/.test(origin);
    
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Expires');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Utility functions
function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  return TokenManager.verifyToken(token);
}

async function findStaffByEmail(email) {
  try {
    const [rows] = await db.execute('SELECT * FROM staff WHERE email = ?', [email]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    return null;
  }
}

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// =============================================================================
// HEALTH CHECK & ROOT ENDPOINTS
// =============================================================================

// Root endpoint for Railway health check
app.get('/', (req, res) => {
  res.json({
    message: 'Young Eagles API Server is running',
    status: 'healthy',
    version: '2.0.0',
    environment: 'production',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      api: '/api',
      auth: '/api/auth/*',
      admin: '/api/admin/*'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: 'production',
    database: 'connected',
    authentication: 'secure'
  });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'Young Eagles API Server',
    version: '2.0.0',
    environment: 'production',
    endpoints: {
      auth: '/api/auth/*',
      admin: '/api/admin/*',
      parent: '/api/parent/*',
      teacher: '/api/teacher/*',
      homework: '/api/homework/*'
    }
  });
});

// =============================================================================
// AUTHENTICATION ENDPOINTS
// =============================================================================

app.post('/api/auth/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
        error: 'MISSING_CREDENTIALS'
      });
    }
    
    const staff = await findStaffByEmail(email);
    
    if (!staff || staff.role !== 'admin') {
      return res.status(401).json({
        message: 'Invalid email or password',
        error: 'INVALID_CREDENTIALS'
      });
    }
    
    if (!PasswordSecurity.verifyPassword(password, staff.password)) {
      return res.status(401).json({
        message: 'Invalid email or password',
        error: 'INVALID_CREDENTIALS'
      });
    }
    
    const accessToken = TokenManager.generateToken(staff);
    
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
    res.status(500).json({
      message: 'Internal server error',
      error: 'INTERNAL_ERROR'
    });
  }
});

app.post('/api/auth/teacher-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
        error: 'MISSING_CREDENTIALS'
      });
    }
    
    const staff = await findStaffByEmail(email);
    
    if (!staff || staff.role !== 'teacher') {
      return res.status(401).json({
        message: 'Invalid email or password',
        error: 'INVALID_CREDENTIALS'
      });
    }
    
    if (!PasswordSecurity.verifyPassword(password, staff.password)) {
      return res.status(401).json({
        message: 'Invalid email or password',
        error: 'INVALID_CREDENTIALS'
      });
    }
    
    const accessToken = TokenManager.generateToken(staff);
    
    res.json({
      message: 'Teacher login successful',
      accessToken,
      user: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        className: staff.class_name
      }
    });
    
  } catch (error) {
    res.status(500).json({
      message: 'Internal server error',
      error: 'INTERNAL_ERROR'
    });
  }
});

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

// Admin dashboard statistics
app.get('/api/admin/dashboard', async (req, res) => {
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
    const [homeworkStats] = await db.execute('SELECT COUNT(*) as count FROM homework');
    const [staffStats] = await db.execute('SELECT COUNT(*) as count FROM staff WHERE role = "teacher"');
    const [submissionStats] = await db.execute('SELECT COUNT(*) as count FROM submissions');
    
    // Get recent activity
    const [recentUsers] = await db.execute('SELECT name, email, created_at FROM users ORDER BY created_at DESC LIMIT 3');
    const [recentHomework] = await db.execute('SELECT title, created_at FROM homework ORDER BY created_at DESC LIMIT 3');
    
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
    res.status(500).json({
      message: 'Internal server error',
      error: 'DATABASE_ERROR'
    });
  }
});

// Admin analytics endpoint
app.get('/api/admin/analytics', async (req, res) => {
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
        class_name,
        COUNT(*) as student_count
      FROM children 
      GROUP BY class_name
      ORDER BY student_count DESC
    `);
    
    res.json({
      monthlyUsers,
      homeworkSubmissions,
      classDistribution,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      message: 'Internal server error',
      error: 'DATABASE_ERROR'
    });
  }
});

// Admin quick actions endpoint
app.get('/api/admin/quick-actions', async (req, res) => {
  const user = verifyToken(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({
      message: 'Forbidden - admin access required',
      error: 'FORBIDDEN'
    });
  }
  
  try {
    // Get pending items that need admin attention
    const [pendingUsers] = await db.execute('SELECT COUNT(*) as count FROM users WHERE is_verified = FALSE');
    const [overdueHomework] = await db.execute('SELECT COUNT(*) as count FROM homework WHERE due_date < NOW() AND status != "completed"');
    const [unreadMessages] = await db.execute('SELECT COUNT(*) as count FROM messages WHERE recipient_id = ? AND is_read = FALSE', [user.id]);
    
    const quickActions = [
      {
        id: 'pending_users',
        title: 'Pending User Verifications',
        count: pendingUsers[0].count,
        priority: pendingUsers[0].count > 0 ? 'high' : 'low',
        action: '/admin/users?filter=pending'
      },
      {
        id: 'overdue_homework',
        title: 'Overdue Homework',
        count: overdueHomework[0].count,
        priority: overdueHomework[0].count > 5 ? 'high' : 'medium',
        action: '/admin/homework?filter=overdue'
      },
      {
        id: 'unread_messages',
        title: 'Unread Messages',
        count: unreadMessages[0].count,
        priority: unreadMessages[0].count > 0 ? 'medium' : 'low',
        action: '/admin/messages'
      }
    ];
    
    res.json({
      quickActions,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      message: 'Internal server error',
      error: 'DATABASE_ERROR'
    });
  }
});

// Admin users management
app.get('/api/admin/users', async (req, res) => {
  const user = verifyToken(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({
      message: 'Forbidden - admin access required',
      error: 'FORBIDDEN'
    });
  }
  
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;
    
    let query = 'SELECT id, name, email, role, created_at, is_verified FROM users';
    let countQuery = 'SELECT COUNT(*) as total FROM users';
    let params = [];
    
    if (search) {
      query += ' WHERE name LIKE ? OR email LIKE ?';
      countQuery += ' WHERE name LIKE ? OR email LIKE ?';
      params = [`%${search}%`, `%${search}%`];
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const [users] = await db.execute(query, params);
    const [totalResult] = await db.execute(countQuery, search ? [`%${search}%`, `%${search}%`] : []);
    
    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total: totalResult[0].total,
        pages: Math.ceil(totalResult[0].total / limit)
      }
    });
    
  } catch (error) {
    res.status(500).json({
      message: 'Internal server error',
      error: 'DATABASE_ERROR'
    });
  }
});

// =============================================================================
// FILE UPLOAD ENDPOINTS
// =============================================================================

app.post('/api/homework/submit', upload.array('files', 10), async (req, res) => {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized - please log in',
      error: 'UNAUTHORIZED'
    });
  }
  
  try {
    const { homeworkId, childId, notes } = req.body;
    const files = req.files || [];
    
    if (!homeworkId || !childId) {
      return res.status(400).json({
        message: 'Homework ID and Child ID are required',
        error: 'MISSING_FIELDS'
      });
    }
    
    // Insert submission record
    const [result] = await db.execute(
      'INSERT INTO submissions (homework_id, child_id, parent_id, notes, submitted_at, file_count) VALUES (?, ?, ?, ?, NOW(), ?)',
      [homeworkId, childId, user.id, notes || '', files.length]
    );
    
    const submissionId = result.insertId;
    
    // Insert file records
    for (const file of files) {
      await db.execute(
        'INSERT INTO submission_files (submission_id, filename, original_name, file_path, file_size, mime_type) VALUES (?, ?, ?, ?, ?, ?)',
        [submissionId, file.filename, file.originalname, file.path, file.size, file.mimetype]
      );
    }
    
    res.json({
      success: true,
      message: 'Homework submitted successfully',
      submissionId,
      filesUploaded: files.length
    });
    
  } catch (error) {
    res.status(500).json({
      message: 'Internal server error',
      error: 'UPLOAD_ERROR'
    });
  }
});

// =============================================================================
// WEBSOCKET HANDLERS
// =============================================================================

io.on('connection', (socket) => {
  socket.on('join-room', (room) => {
    socket.join(room);
  });
  
  socket.on('send-message', (data) => {
    socket.to(data.room).emit('receive-message', data);
  });
  
  socket.on('homework-update', (data) => {
    socket.broadcast.emit('homework-notification', data);
  });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function startServer() {
  const dbConnected = await initDatabase();
  if (!dbConnected) {
    process.exit(1);
  }
  
  // Update admin password on startup
  try {
    const adminPassword = 'YoungEagles2024!';
    const hashedPassword = PasswordSecurity.hashPassword(adminPassword);
    
    await db.execute(
      'UPDATE staff SET password = ? WHERE email = ? AND role = ?',
      [hashedPassword, 'admin@youngeagles.org.za', 'admin']
    );
  } catch (error) {
    // Admin user doesn't exist, create it
    const hashedPassword = PasswordSecurity.hashPassword('YoungEagles2024!');
    await db.execute(
      'INSERT INTO staff (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE password = VALUES(password)',
      ['System Administrator', 'admin@youngeagles.org.za', hashedPassword, 'admin']
    );
  }
  
  server.listen(PORT, '0.0.0.0', () => {
    // Server started successfully
  });
}

// Error handling
process.on('uncaughtException', (error) => {
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  process.exit(1);
});

startServer(); 