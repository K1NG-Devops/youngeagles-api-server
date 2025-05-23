import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import { query, testAllConnections } from './db.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import attendanceRoutes from './routes/attendance.routes.js';

testAllConnections();

const app = express();
app.use(express.json());
app.set('trust proxy', 1);

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




app.use(express.static('public'));
app.use(express.static('uploads'));

const port = process.env.PORT || 3000;
const allowedOrigins = [
  'https://react-app-iota-nine.vercel.app',
  'https://www.youngeagles.org.za',
  'http://localhost:5173',
];

if (process.env.NODE_ENV === 'development' && process.env.CORS_ORIGIN) {
  allowedOrigins.push(process.env.CORS_ORIGIN);
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  optionsSuccessStatus: 204,
}));

app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api', (req, res) => {
  res.json({ message: 'API is running' });
});

app.use('/api/auth', authRoutes);

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads/pops');
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });
// POP submission route
app.post('/api/public/pop-submission', async (req, res) => {
  const {
    fullname,
    email,
    phone,
    studentName,
    amount,
    paymentDate,
    paymentMethod,
    bankName,
    popFilePath,
  } = req.body;

  if (!fullname || !email || !phone || !amount || !paymentDate || !paymentMethod || !popFilePath) {
    return res.status(400).json({ message: 'Missing required fields. Please include all required fields and the file URL.' });
  }

  try {
    const sql = `
      INSERT INTO pop_submission 
      (fullname, email, phone, studentName, amount, paymentDate, paymentMethod, bankName, popFilePath)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [fullname, email, phone, studentName, amount, paymentDate, paymentMethod, bankName, popFilePath];
    await query(sql, values);

    res.status(201).json({ message: 'POP submission successful!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error submitting POP', error: error.message });
  }
});

app.use('api/attendance', attendanceRoutes);

app.listen(port, () => {
  console.log(`API server is running on port ${port}`);
});
