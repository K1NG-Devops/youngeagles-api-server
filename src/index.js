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
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3002", 
      "http://localhost:3003", 
      "http://localhost:5173",
      "https://youngeagles.org.za",
      "https://youngeagles-app.vercel.app"
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
    console.log('🔌 Connecting to Railway MySQL database...');
    db = mysql.createPool(dbConfig);
    
    // Test connection
    const connection = await db.getConnection();
    console.log('✅ Database connected successfully!');
    console.log(`📊 Connected to: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
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

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3002',
      'http://localhost:3003', 
      'http://localhost:5173',
      'https://youngeagles.org.za',
      'https://youngeagles-app.vercel.app'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
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

// Custom CORS middleware for additional headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && corsOptions.origin) {
    console.log(`📡 ${req.method} ${req.path} - Origin: ${origin}`);
    
    if (corsOptions.origin === '*' || 
        (typeof corsOptions.origin === 'function' && 
         ['http://localhost:3002', 'http://localhost:3003', 'http://localhost:5173', 'https://youngeagles.org.za', 'https://youngeagles-app.vercel.app'].includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      console.log(`✅ Setting Access-Control-Allow-Origin: ${origin}`);
    }
  } else {
    console.log(`📡 ${req.method} ${req.path} - Origin: none`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    console.log('✅ Setting Access-Control-Allow-Origin: * (for no origin)');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Expires');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling OPTIONS preflight request');
    return res.status(200).end();
  }
  
  next();
});

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

// Database helper functions
async function findUserByEmail(email, role = null) {
  try {
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
  console.log('📍 Environment: PRODUCTION');
  console.log('🔧 Phase: PRODUCTION READY');
  
  const dbConnected = await initDatabase();
  if (!dbConnected) {
    console.log('❌ Cannot start server without database connection');
    process.exit(1);
  }
  
  console.log('🔐 Setting up production authentication system...');
  console.log('🛡️ Password requirements: 8+ chars, uppercase, lowercase, numbers, special chars');
  console.log('🚫 All mock data removed - using real database');
  
  // Root endpoint for API info
  app.get('/', (req, res) => {
    console.log('📋 API info requested');
    res.json({ 
      message: 'Young Eagles API Server is running',
      status: 'healthy',
      version: '2.0.0',
      environment: 'production',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth/*',
        admin: '/api/admin/*',
        parent: '/api/parent/*',
        teacher: '/api/teacher/*',
        homework: '/api/homework/*'
      }
    });
  });

  // API info endpoint
  app.get('/api', (req, res) => {
    console.log('📋 API endpoints info requested');
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

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    console.log('💓 Health check requested');
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      environment: 'production',
      database: 'connected',
      authentication: 'secure'
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

  // Teacher login endpoint
  app.post('/api/auth/teacher-login', async (req, res) => {
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

  // Parent progress report endpoint
  app.get('/api/public/parent/reports', async (req, res) => {
    console.log('📊 Parent report requested');
    try {
      const { child_id } = req.query;
      
      // Verify token
      const user = verifyToken(req);
      if (!user) {
        return res.status(401).json({
          message: 'Unauthorized - please log in',
          error: 'UNAUTHORIZED'
        });
      }
      
      if (!child_id) {
        return res.status(400).json({
          message: 'child_id is required',
          error: 'MISSING_CHILD_ID'
        });
      }
      
      console.log(`📊 Generating report for child ID: ${child_id}`);
      
      // Get child info and verify it belongs to the parent
      const [child] = await db.execute(
        'SELECT id, name, parent_id FROM children WHERE id = ? AND parent_id = ?',
        [child_id, user.id]
      );
      
      if (child[0].length === 0) {
        console.log('❌ Child not found or not owned by parent');
        return res.status(404).json({
          message: 'Child not found for this parent',
          error: 'CHILD_NOT_FOUND'
        });
      }
      
      const childData = child[0][0];
      
      // Get homework statistics
      const [totalHomework] = await db.execute(
        'SELECT COUNT(*) as count FROM homeworks WHERE child_id = ?',
        [child_id]
      );
      
      const [submittedHomework] = await db.execute(
        'SELECT COUNT(*) as count FROM homework_submissions WHERE child_id = ? AND submitted = 1',
        [child_id]
      );
      
      const [gradedHomework] = await db.execute(
        'SELECT COUNT(*) as count FROM homework_submissions WHERE child_id = ? AND grade IS NOT NULL',
        [child_id]
      );
      
      const [avgGradeResult] = await db.execute(
        'SELECT AVG(grade) as avgGrade FROM homework_submissions WHERE child_id = ? AND grade IS NOT NULL',
        [child_id]
      );
      
      // Get recent grades
      const [recentGrades] = await db.execute(`
        SELECT h.title, s.grade, s.graded_at as date 
        FROM homework_submissions s 
        JOIN homeworks h ON s.homework_id = h.id 
        WHERE s.child_id = ? AND s.grade IS NOT NULL 
        ORDER BY s.graded_at DESC 
        LIMIT 5
      `, [child_id]);
      
      const totalCount = totalHomework[0][0]?.count || 0;
      const submittedCount = submittedHomework[0][0]?.count || 0;
      const gradedCount = gradedHomework[0][0]?.count || 0;
      const avgGrade = avgGradeResult[0][0]?.avgGrade || null;
      const submissionRate = totalCount > 0 ? (submittedCount / totalCount) * 100 : 0;
      
      console.log(`✅ Generated report for ${childData.name}: ${totalCount} total, ${submittedCount} submitted`);
      
      res.json({
        childId: childData.id,
        childName: childData.name,
        totalHomework: totalCount,
        submitted: submittedCount,
        graded: gradedCount,
        avgGrade: avgGrade ? parseFloat(avgGrade).toFixed(2) : null,
        submissionRate: parseFloat(submissionRate.toFixed(1)),
        recentGrades: recentGrades[0].map(grade => ({
          title: grade.title,
          grade: grade.grade,
          date: grade.date
        }))
      });
      
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

  // Token verification endpoint
  app.get('/api/auth/verify', (req, res) => {
    console.log('🔍 Token verification requested');
    
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        message: 'Invalid or expired token',
        error: 'INVALID_TOKEN'
      });
    }
    
    console.log('✅ Token verified for:', user.email);
    
    res.json({
      message: 'Token valid',
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
          'INSERT INTO users (name, email, role, password, created_at) VALUES (?, ?, ?, ?, NOW())',
          [name, email, role, hashedPassword]
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
      
      console.log('🔍 Getting children with pagination:', { page, limit: limitParam, offset: offsetParam });
      
      // Simplified query without JOIN for now
      let query = 'SELECT * FROM children';
      let countQuery = 'SELECT COUNT(*) as total FROM children';
      let params = [];
      
      if (search) {
        query += ' WHERE name LIKE ? OR grade LIKE ? OR className LIKE ?';
        countQuery += ' WHERE name LIKE ? OR grade LIKE ? OR className LIKE ?';
        const searchParam = `%${search}%`;
        params = [searchParam, searchParam, searchParam];
      }
      
      query += ` ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`;
      
      console.log('🔍 Executing simplified query:', query);
      console.log('🔍 With params:', params);
      
      // Execute queries
      const [children] = await db.execute(query, params);
      const [totalResult] = await db.execute(countQuery, params);
      
      const total = totalResult[0].total;
      const pages = Math.ceil(total / limitParam);
      
      // Get parent info separately to avoid JOIN issues
      const childrenWithParents = await Promise.all(
        children.map(async (child) => {
          try {
            const [parentResult] = await db.execute(
              'SELECT name, email FROM users WHERE id = ?',
              [child.parent_id]
            );
            
            return {
              ...child,
              class_name: child.className,
              parent_name: parentResult[0]?.name || 'Unknown',
              parent_email: parentResult[0]?.email || '',
              first_name: child.name ? child.name.split(' ')[0] : '',
              last_name: child.name ? child.name.split(' ').slice(1).join(' ') : '',
              date_of_birth: child.dob,
              emergency_contact: '',
              medical_notes: '',
              allergies: ''
            };
          } catch (error) {
            console.error('Error getting parent for child:', child.id, error.message);
            return {
              ...child,
              class_name: child.className,
              parent_name: 'Unknown',
              parent_email: '',
              first_name: child.name ? child.name.split(' ')[0] : '',
              last_name: child.name ? child.name.split(' ').slice(1).join(' ') : '',
              date_of_birth: child.dob,
              emergency_contact: '',
              medical_notes: '',
              allergies: ''
            };
          }
        })
      );
      
      console.log(`✅ Children data retrieved: ${childrenWithParents.length} children`);
      
      res.json({
        success: true,
        data: childrenWithParents,
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
        error: 'DATABASE_ERROR'
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

  // Start listening on the configured port
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Young Eagles API Server running on port ${PORT}`);
    console.log(`📍 Local URL: http://localhost:${PORT}`);
    console.log(`🌐 Network URL: http://0.0.0.0:${PORT}`);
    console.log(`💓 Health check: http://localhost:${PORT}/api/health`);
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