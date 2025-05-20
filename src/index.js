import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import { query, testAllConnections } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

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


app.listen(port, () => {
  console.log(`API server is running on port ${port}`);
});
