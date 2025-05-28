import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import { query, testAllConnections } from './db.js';
import multer from 'multer';
import path from 'path';
import rateLimit from 'express-rate-limit';
import attendanceRoutes from './routes/attendance.routes.js';
import { authMiddleware, isTeacher } from './middleware/authMiddleware.js';
import { getChildrenByTeacher } from './controllers/teacherController.js';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import homeworkRoutes from './routes/homework.routes.js';
import homeworks from './routes/homeworks.js';
import fs from 'fs';

// Setup paths and CORS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedOrigins = [
  'https://react-app-iota-nine.vercel.app',
  'https://www.youngeagles.org.za',
];

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

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API server is running on port ${port}`);
});
