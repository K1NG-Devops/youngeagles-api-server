import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import { query, connect } from './db.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

connect();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests from this IP, please try again later.',
  },
});



const app = express();
app.set('trust proxy', 1);
app.use(limiter);
app.use(express.json());
app.use(express.static('public'));
app.use(express.static('uploads'));
app.use(express.static('uploads/pops'));
app.use(express.static('uploads/children'));
app.use(express.static('uploads/parents'));
app.use(express.static('uploads/parents/avatars'));
app.use(express.static('uploads/children/avatars'));
const port = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'https://react-app-iota-nine.vercel.app',
    'https://www.youngeagles.org.za'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api', (req, res) => {
  res.json({ message: 'API is running' });
});

app.use('/api/auth', authRoutes, limiter);

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
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, and PDF files are allowed'), false);
    }
    cb(null, true);
  }
});
// POP submission route
app.post('/api/public/pop-submission', upload.single('pop'), async (req, res) => {
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
    const popFilePath = `uploads/pops/${req.file.filename}`;
    // const { originalname, mimetype, size } = req.file;

    const sql = `
      INSERT INTO pop_submission 
      (fullname, email, phone, studentName, amount, paymentDate, paymentMethod, bankName, popFilePath)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [fullname, email, phone, studentName, amount, paymentDate, paymentMethod, bankName, popFilePath];
    await query(sql, values);

    res.status(201).json({ message: 'POP submission successful!', popFilePath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error submitting POP', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`API server is running on port ${port}`);
});
