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
  const { completion_answer } = req.body;
  const parent_id = req.user.id;

  if (!completion_answer?.trim()) {
    return res.status(400).json({ message: 'Completion answer is required' });
  }

  try {
    // Check if a completion record already exists
    const existingSql = 'SELECT id FROM homework_completions WHERE homework_id = ? AND parent_id = ?';
    const [existing] = await query(existingSql, [homeworkId, parent_id], 'skydek_DB');

    if (existing) {
      // Update existing completion
      const updateSql = 'UPDATE homework_completions SET completion_answer = ?, updated_at = NOW() WHERE homework_id = ? AND parent_id = ?';
      await execute(updateSql, [completion_answer, homeworkId, parent_id], 'skydek_DB');
    } else {
      // Create new completion record
      const insertSql = 'INSERT INTO homework_completions (homework_id, parent_id, completion_answer, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())';
      await execute(insertSql, [homeworkId, parent_id, completion_answer], 'skydek_DB');
    }

    res.status(200).json({ message: 'Homework completion saved successfully' });
  } catch (error) {
    console.error('Error saving homework completion:', error);
    res.status(500).json({ message: 'Error saving homework completion', error: error.message });
  }
});

// Add submissions routes
app.post('/api/submissions', authMiddleware, async (req, res) => {
  const { homeworkId, fileURL, comment, completion_answer } = req.body;
  const parent_id = req.user.id; // Get parent ID from auth middleware

  if (!homeworkId) {
    return res.status(400).json({ message: 'Homework ID is required' });
  }

  // At least one of fileURL or completion_answer must be provided
  if (!fileURL && !completion_answer?.trim()) {
    return res.status(400).json({ message: 'Either file upload or completion answer is required' });
  }

  try {
    // Insert submission
    const sql = 'INSERT INTO submissions (homework_id, parent_id, file_url, comment, submitted_at) VALUES (?, ?, ?, ?, NOW())';
    const result = await execute(sql, [homeworkId, parent_id, fileURL || null, comment || null], 'skydek_DB');
    
    // If completion answer is provided, save/update it
    if (completion_answer?.trim()) {
      const existingSql = 'SELECT id FROM homework_completions WHERE homework_id = ? AND parent_id = ?';
      const [existing] = await query(existingSql, [homeworkId, parent_id], 'skydek_DB');
      
      if (existing) {
        await execute(
          'UPDATE homework_completions SET completion_answer = ?, updated_at = NOW() WHERE homework_id = ? AND parent_id = ?',
          [completion_answer, homeworkId, parent_id],
          'skydek_DB'
        );
      } else {
        await execute(
          'INSERT INTO homework_completions (homework_id, parent_id, completion_answer, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          [homeworkId, parent_id, completion_answer],
          'skydek_DB'
        );
      }
    }
    
    res.status(201).json({ message: 'Homework submitted successfully', submissionId: result.insertId });
  } catch (error) {
    console.error('Error submitting homework:', error);
    res.status(500).json({ message: 'Error submitting homework', error: error.message });
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
  if (!studentId || !studentName || !className || !grade || !teacherId || !date || !day || !results || !type) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }
  try {
    const submission = await HomeworkSubmission.create({
      studentId,
      studentName,
      className,
      grade,
      teacherId,
      date,
      day,
      results,
      type,
    });
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

app.post('/api/fcm/token', authMiddleware, (req, res) => {
  const { token } = req.body;
  const userId = req.user.id;
  // TODO: Save the token in the database associated with userId
  console.log(`Received FCM token for user ${userId}:`, token);
  res.status(200).json({ message: 'Token received' });
});
