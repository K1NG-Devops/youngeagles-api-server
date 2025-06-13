import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import { query, testAllConnections } from './db.js';
import multer from 'multer';
import path from 'path';
import rateLimit from 'express-rate-limit';
import attendanceRoutes from './routes/attendance.routes.js';
import { authMiddleware, isTeacher, isTeacherOrAdmin } from './middleware/authMiddleware.js';
import { getChildrenByTeacher } from './controllers/teacherController.js';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import homeworkRoutes from './routes/homework.routes.js';
import { execute } from './db.js';
import homeworks from './routes/homeworks.js';
import fs from 'fs';
import Event from './models/events.js';
import sequelize from './db.js';
import eventRoutes from './routes/event.routes.js';
import { getTeacherByClass } from './controllers/teacherByClassController.js';
import { Sequelize, DataTypes } from 'sequelize';
import { initializeFirebaseAdmin } from './config/firebase-admin.js';

// Setup paths and CORS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedOrigins = [
  'https://react-app-iota-nine.vercel.app',
  'https://www.youngeagles.org.za',
  'http://localhost:5173',
];

// Always allow localhost:5173 in development for React dev server
if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:5173');
}

if (process.env.NODE_ENV === 'development' && process.env.CORS_ORIGIN) {
  allowedOrigins.push(process.env.CORS_ORIGIN);
}

testAllConnections();

// Initialize Firebase Admin for push notifications
console.log('🚀 Initializing Firebase Admin SDK...');
initializeFirebaseAdmin();

const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'cache-control'],
  optionsSuccessStatus: 204,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests from this IP, please try again later.',
  },
});
app.use(limiter);
app.set('trust proxy', 1);

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/children', authMiddleware, isTeacher, getChildrenByTeacher);
app.use('/api/attendance/:teacherId', authMiddleware, isTeacher, getChildrenByTeacher);
app.use('/api/homeworks', homeworks);
app.use('/api/homeworks', homeworkRoutes);

// Homework completion endpoint
app.post('/api/homeworks/:homeworkId/complete', authMiddleware, async (req, res) => {
  const { homeworkId } = req.params;
  const { 
    completion_answer, 
    activity_result, 
    activity_type, 
    childId, 
    childName, 
    parentId,
    completed = false
  } = req.body;
  
  const parent_id = req.user.id;

  console.log('📝 Homework completion request:', {
    homeworkId,
    parent_id,
    hasAnswer: !!completion_answer,
    hasActivityResult: !!activity_result,
    activity_type,
    childName,
    completed
  });

  // For interactive activities, we might not have completion_answer but have activity_result
  if (!completion_answer?.trim() && !activity_result) {
    return res.status(400).json({ message: 'Either completion answer or activity result is required' });
  }

  try {
    // Check if a completion record already exists
    const existingSql = 'SELECT id FROM homework_completions WHERE homework_id = ? AND parent_id = ?';
    const [existing] = await query(existingSql, [homeworkId, parent_id], 'skydek_DB');

    // Prepare completion answer (combine text and activity result for storage)
    const finalCompletionAnswer = completion_answer || (
      activity_result ? 
        `Interactive Activity Result: ${JSON.stringify(activity_result)}` :
        null
    );

    if (existing) {
      // Update existing completion - use only basic columns that exist
      const updateSql = `
        UPDATE homework_completions 
        SET completion_answer = ?, updated_at = NOW() 
        WHERE homework_id = ? AND parent_id = ?
      `;
      await execute(updateSql, [
        finalCompletionAnswer,
        homeworkId,
        parent_id
      ], 'skydek_DB');
      
      console.log('✅ Updated existing homework completion');
    } else {
      // Create new completion record - use only basic columns that exist
      const insertSql = `
        INSERT INTO homework_completions 
        (homework_id, parent_id, completion_answer, created_at, updated_at) 
        VALUES (?, ?, ?, NOW(), NOW())
      `;
      await execute(insertSql, [
        homeworkId,
        parent_id,
        finalCompletionAnswer
      ], 'skydek_DB');
      
      console.log('✅ Created new homework completion');
    }

    // Store additional interactive activity metadata in a separate way if needed
    if (activity_result && activity_type) {
      console.log('📊 Activity metadata stored in completion answer:', {
        activity_type,
        childName,
        hasResult: !!activity_result
      });
    }

    res.status(200).json({ 
      message: 'Homework completion saved successfully',
      data: {
        homework_id: homeworkId,
        completed: true,
        activity_type: activity_type || null
      }
    });
  } catch (error) {
    console.error('🔥 Error saving homework completion:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      message: 'Error saving homework completion', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Add submissions routes
app.post('/api/submissions', authMiddleware, async (req, res) => {
  console.log('📥 Submission request received:', {
    body: req.body,
    user: req.user,
    headers: req.headers.authorization ? 'Bearer token present' : 'No auth header'
  });
  
  const { homeworkId, parentId, fileURL, comment, completion_answer, activity_result, isInteractive } = req.body;
  const parent_id = parentId || req.user.id; // Use provided parentId or fall back to auth user

  console.log('📋 Processed submission data:', {
    homeworkId,
    parentId,
    parent_id,
    hasFileURL: !!fileURL,
    hasCompletionAnswer: !!completion_answer,
    hasActivityResult: !!activity_result,
    isInteractive
  });

  if (!homeworkId) {
    console.error('❌ Missing homework ID');
    return res.status(400).json({ message: 'Homework ID is required' });
  }

  // For interactive activities, we need either activity_result or completion_answer
  // For file-based homework, we need fileURL or completion_answer
  if (isInteractive) {
    if (!activity_result && !completion_answer?.trim()) {
      console.error('❌ Interactive homework missing required data');
      return res.status(400).json({ message: 'Activity result or completion answer is required for interactive homework' });
    }
  } else {
    if (!fileURL && !completion_answer?.trim()) {
      console.error('❌ File-based homework missing required data');
      return res.status(400).json({ message: 'Either file upload or completion answer is required' });
    }
  }

  try {
    console.log('💾 Inserting submission into database...');
    // Insert submission
    const sql = 'INSERT INTO submissions (homework_id, parent_id, file_url, comment, submitted_at) VALUES (?, ?, ?, ?, NOW())';
    const result = await execute(sql, [homeworkId, parent_id, fileURL || null, comment || null], 'skydek_DB');
    console.log('✅ Submission inserted with ID:', result.insertId);
    
    // If completion answer or activity result is provided, save/update it
    const answerToSave = completion_answer?.trim() || (activity_result ? JSON.stringify(activity_result) : null);
    if (answerToSave) {
      console.log('💾 Saving completion answer/activity result...');
      const existingSql = 'SELECT id FROM homework_completions WHERE homework_id = ? AND parent_id = ?';
      const [existing] = await query(existingSql, [homeworkId, parent_id], 'skydek_DB');
      
      if (existing) {
        console.log('🔄 Updating existing completion record...');
        await execute(
          'UPDATE homework_completions SET completion_answer = ?, updated_at = NOW() WHERE homework_id = ? AND parent_id = ?',
          [answerToSave, homeworkId, parent_id],
          'skydek_DB'
        );
      } else {
        console.log('➕ Creating new completion record...');
        await execute(
          'INSERT INTO homework_completions (homework_id, parent_id, completion_answer, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          [homeworkId, parent_id, answerToSave],
          'skydek_DB'
        );
      }
      console.log('✅ Completion data saved successfully');
    }
    
    console.log('🎉 Homework submission completed successfully');
    res.status(201).json({ message: 'Homework submitted successfully', submissionId: result.insertId });
  } catch (error) {
    console.error('🔥 Error submitting homework:', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      message: 'Error submitting homework', 
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack })
    });
  }
});

// Delete submission route
app.delete('/api/submissions/:submissionId', authMiddleware, async (req, res) => {
  const { submissionId } = req.params;
  const parent_id = req.user.id;

  try {
    // First verify the submission belongs to this parent
    const checkSql = 'SELECT * FROM submissions WHERE id = ? AND parent_id = ?';
    const [submission] = await query(checkSql, [submissionId, parent_id], 'skydek_DB');
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found or you do not have permission to delete it' });
    }

    // Delete the submission
    const deleteSql = 'DELETE FROM submissions WHERE id = ? AND parent_id = ?';
    const result = await execute(deleteSql, [submissionId, parent_id], 'skydek_DB');
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.status(200).json({ message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ message: 'Error deleting submission', error: error.message });
  }
});
app.use('/api/events', eventRoutes);
app.get('/api/teachers/by-class', authMiddleware, isTeacherOrAdmin, getTeacherByClass);

// Get teacher's class information
app.get('/api/teachers/:teacherId', authMiddleware, isTeacher, async (req, res) => {
  const { teacherId } = req.params;

  try {
    const rows = await query('SELECT * FROM users WHERE id = ?', [teacherId], 'railway');
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    const teacher = rows[0];
    res.json({
      message: 'Teacher information retrieved successfully',
      teacher: {
        id: teacher.id,
        fullname: teacher.fullname,
        email: teacher.email,
        phone: teacher.phone,
        className: teacher.className,
        grade: teacher.grade,
        profilePicture: teacher.profilePicture ? `/uploads/profile/${teacher.profilePicture}` : null,
        createdAt: teacher.createdAt,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving teacher information', error: error.message });
  }
  });

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Young Eagles API Server', 
    status: 'running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      homework: '/api/homework',
      homeworks: '/api/homeworks',
      attendance: '/api/attendance',
      events: '/api/events',
      fcm: '/api/fcm'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage()
  });
});

// API health check route for consistency
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    api: 'Young Eagles API Server',
    version: '1.0.0'
  });
});

// Test route
app.get('/api', (req, res) => {
  res.json({ message: 'API is running' });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const rows = await query('SELECT DATABASE() AS db, USER() AS user, VERSION() AS version');
    res.json({
      message: 'Database connection successful',
      db: rows[0].db,
      user: rows[0].user,
      version: rows[0].version,
      timestamp: new Date().toISOString(),
      serverTime: new Date().toLocaleString(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Database connection failed', error: error.message });
  }
});

// POP list route
app.get('/api/pops', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM pop_submission');
    res.json({
      message: 'POPs retrieved successfully',
      POPs: rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving POPs', error: error.message });
  }
});

// Ensure directory exists
const popDir = path.join(__dirname, 'uploads/pops');
if (!fs.existsSync(popDir)) {
  fs.mkdirSync(popDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, popDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitized = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
    cb(null, uniqueSuffix + '-' + sanitized);
  }
});
const upload = multer({ storage: storage });

// POP submission route
app.post('/api/public/pop-submission', upload.single('popFile'), async (req, res) => {
  // const popFilePath = req.file ? `/uploads/pops/${req.file.filename}` : null;
  const {
    fullname,
    email,
    phone,
    studentName,
    amount,
    paymentDate,
    paymentMethod,
    bankName,
  } = req.body;

  if (!fullname || !email || !phone || !amount || !paymentDate || !paymentMethod) { //!popFilePath to add later
    return res.status(400).json({ message: 'Missing required fields. Please include all required fields and the file URL.' });
  }

  try {
    const sql = `
      INSERT INTO pop_submission 
      (fullname, email, phone, studentName, amount, paymentDate, paymentMethod, bankName) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;//popFilePath to add later
    const values = [fullname, email, phone, studentName, amount, paymentDate, paymentMethod, bankName]; //popFilePath to add later
    await query(sql, values);

    res.status(201).json({ message: 'POP submission successful!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error submitting POP', error: error.message });
  }
});

// Define the homework_submissions model if not already defined
const HomeworkSubmission = sequelize.define('homework_submissions', {
  studentId: { type: DataTypes.INTEGER, allowNull: false },
  studentName: { type: DataTypes.STRING, allowNull: false },
  className: { type: DataTypes.STRING, allowNull: false },
  grade: { type: DataTypes.STRING, allowNull: false },
  teacherId: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATE, allowNull: false },
  day: { type: DataTypes.STRING, allowNull: false },
  results: { type: DataTypes.JSON, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false },
  createdAt: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
  updatedAt: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
}, {
  tableName: 'homework_submissions',
  timestamps: true,
});

app.post('/api/homework-submissions', authMiddleware, async (req, res) => {
  const { studentId, studentName, className, grade, teacherId, date, day, results, type } = req.body;
  const parent_id = req.user.id;
  
  if (!studentId || !studentName || !className || !grade || !results || !type) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }
  
  try {
    // Get homework details to find the teacher if not provided
    let actualTeacherId = teacherId;
    let homeworkTitle = 'Homework';
    
    if (results.homeworkId) {
      const homework = await query(
        'SELECT uploaded_by_teacher_id, title FROM homeworks WHERE id = ?',
        [results.homeworkId],
        'skydek_DB'
      );
      
      if (homework && homework.length > 0) {
        actualTeacherId = homework[0].uploaded_by_teacher_id;
        homeworkTitle = homework[0].title;
      }
    }
    
    // Create submission record
    const submission = await HomeworkSubmission.create({
      studentId,
      studentName,
      className,
      grade,
      teacherId: actualTeacherId,
      date,
      day,
      results,
      type,
    });
    
    // Store in submissions table for parent tracking
    if (results.homeworkId) {
      try {
        const submissionSql = `
          INSERT INTO submissions (homework_id, parent_id, file_url, comment, submitted_at)
          VALUES (?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE 
          file_url = VALUES(file_url),
          comment = VALUES(comment),
          submitted_at = VALUES(submitted_at)
        `;
        
        await execute(submissionSql, [
          results.homeworkId,
          parent_id,
          results.fileURL || null,
          results.comment || ''
        ], 'skydek_DB');
        
        // Save completion answer if provided
        if (results.completion_answer) {
          const completionSql = `
            INSERT INTO homework_completions (homework_id, parent_id, completion_answer, completed_at)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
            completion_answer = VALUES(completion_answer),
            completed_at = VALUES(completed_at)
          `;
          
          await execute(completionSql, [
            results.homeworkId,
            parent_id,
            results.completion_answer
          ], 'skydek_DB');
        }
      } catch (dbError) {
        console.error('Error updating submission tables:', dbError);
      }
    }
    
    // Send notification to teacher
    if (actualTeacherId) {
      try {
        const notificationMessage = `${studentName} has submitted homework: ${homeworkTitle}`;
        
        // Create notifications table if it doesn't exist
        await execute(`
          CREATE TABLE IF NOT EXISTS notifications (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            user_type ENUM('teacher', 'parent', 'admin') DEFAULT 'teacher',
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            type VARCHAR(50) DEFAULT 'homework_submission',
            related_id INT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `, [], 'skydek_DB');
        
        // Store notification
        const notificationSql = `
          INSERT INTO notifications (user_id, user_type, title, message, type, related_id, created_at)
          VALUES (?, 'teacher', ?, ?, 'homework_submission', ?, NOW())
        `;
        
        await execute(notificationSql, [
          actualTeacherId,
          'New Homework Submission',
          notificationMessage,
          results.homeworkId || null
        ], 'skydek_DB');
        
        console.log(`✅ Notification sent to teacher ${actualTeacherId} for ${studentName}'s submission`);
      } catch (notificationError) {
        console.error('Error sending teacher notification:', notificationError);
        // Don't fail the submission if notification fails
      }
    }
    
    res.status(201).json({ message: 'Homework submission saved!', submission });
  } catch (error) {
    console.error('Error saving homework submission:', error);
    res.status(500).json({ message: 'Error saving homework submission', error: error.message });
  }
});

// Sync Sequelize models with the database
debugger;
sequelize.sync({ alter: true })
  .then(() => {
    console.log('Database & tables synced!');
  })
  .catch((err) => {
    console.error('Error syncing database:', err);
  });

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API server is running on port ${port}`);
});

app.post('/api/fcm/token', authMiddleware, async (req, res) => {
  const { token, deviceInfo } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;
  
  if (!token) {
    return res.status(400).json({ message: 'FCM token is required' });
  }
  
  // Determine database and user type based on role
  let database, userType;
  if (userRole === 'parent') {
    database = 'skydek_DB';
    userType = 'parent';
  } else if (userRole === 'teacher') {
    database = 'railway';
    userType = 'teacher';
  } else if (userRole === 'admin') {
    database = 'railway';
    userType = 'admin';
  } else {
    return res.status(400).json({ message: 'Invalid user role for FCM registration' });
  }
  
  try {
    // Check if token already exists for this user
    const existingToken = await query(
      'SELECT id FROM fcm_tokens WHERE user_id = ? AND user_type = ? AND token = ?', 
      [userId, userType, token],
      database
    );
    
    if (existingToken.length === 0) {
      // Insert new token
      await execute(
        `INSERT INTO fcm_tokens (user_id, user_type, token, device_info, last_used, created_at, updated_at) 
         VALUES (?, ?, ?, ?, NOW(), NOW(), NOW()) 
         ON DUPLICATE KEY UPDATE 
         device_info = VALUES(device_info), 
         last_used = NOW(), 
         updated_at = NOW(), 
         is_active = TRUE`, 
        [userId, userType, token, deviceInfo ? JSON.stringify(deviceInfo) : null],
        database
      );
      
      console.log(`✅ FCM token saved for ${userType} ${userId} in ${database}`);
    } else {
      // Update existing token timestamp
      await execute(
        'UPDATE fcm_tokens SET last_used = NOW(), updated_at = NOW(), is_active = TRUE WHERE user_id = ? AND user_type = ? AND token = ?',
        [userId, userType, token],
        database
      );
      
      console.log(`🔄 FCM token updated for ${userType} ${userId} in ${database}`);
    }
    
    res.status(200).json({ 
      message: 'FCM token registered successfully',
      userType,
      database: database === 'skydek_DB' ? 'Parents/Children DB' : 'Teachers/Admin DB'
    });
  } catch (error) {
    console.error('Error saving FCM token:', error);
    res.status(500).json({ 
      message: 'Failed to register FCM token', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

// FCM Token cleanup endpoint (optional - for removing inactive tokens)
app.delete('/api/fcm/token/:tokenId', authMiddleware, async (req, res) => {
  const { tokenId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  
  const database = (userRole === 'parent') ? 'skydek_DB' : 'railway';
  const userType = userRole === 'admin' ? 'admin' : userRole;
  
  try {
    const result = await execute(
      'UPDATE fcm_tokens SET is_active = FALSE WHERE id = ? AND user_id = ? AND user_type = ?',
      [tokenId, userId, userType],
      database
    );
    
    if (result.affectedRows > 0) {
      res.status(200).json({ message: 'FCM token deactivated successfully' });
    } else {
      res.status(404).json({ message: 'FCM token not found or already inactive' });
    }
  } catch (error) {
    console.error('Error deactivating FCM token:', error);
    res.status(500).json({ message: 'Failed to deactivate FCM token' });
  }
});

// Get user's FCM tokens (for debugging/admin purposes)
app.get('/api/fcm/tokens', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  
  const database = (userRole === 'parent') ? 'skydek_DB' : 'railway';
  const userType = userRole === 'admin' ? 'admin' : userRole;
  
  try {
    const tokens = await query(
      'SELECT id, device_type, is_active, last_used, created_at FROM fcm_tokens WHERE user_id = ? AND user_type = ? AND is_active = TRUE',
      [userId, userType],
      database
    );
    
    res.status(200).json({ 
      tokens,
      count: tokens.length,
      userType,
      database: database === 'skydek_DB' ? 'Parents/Children DB' : 'Teachers/Admin DB'
    });
  } catch (error) {
    console.error('Error fetching FCM tokens:', error);
    res.status(500).json({ message: 'Failed to fetch FCM tokens' });
  }
});
