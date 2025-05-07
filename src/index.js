import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import { query, connect } from './db.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

connect();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: 'https://youngeagles.org.za',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files
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
    console.error(error); // ✅ fixed
    res.status(500).json({ message: 'Database connection failed', error: error.message });
  }
});

app.get('/api/POPs', async (req, res) => {
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

// File upload config
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads/POPS'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.post('/api/public/pop-submission', upload.single('file'), async (req, res) => {
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

  const popFilePath = req.file?.path;

  if (!fullname || !email || !phone || !studentName || !amount || !paymentDate || !paymentMethod || !bankName) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  if (!popFilePath) {
    return res.status(400).json({ message: 'File upload is required.' });
  }

  try {
    const sql = `
      INSERT INTO pop_submission (fullname, email, phone, studentName, amount, paymentDate, paymentMethod, bankName, popFilePath)
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
