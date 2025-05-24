import { query, execute } from '../db.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/jwt.js';
import { validationResult } from 'express-validator';
import dotenv from 'dotenv';
import winston from 'winston';

dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

// Register Parent
export const registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, phone, password, address, workAddress } = req.body;
  const role = 'parent';

  try {
    const existing = await query('SELECT id FROM users WHERE email = ?', [email], 'skydek_DB');
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12); // Increased salt rounds
    await execute(
      'INSERT INTO users (name, email, phone, address, workaddress, password, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone, address, workAddress, hashedPassword, role]
    );

    res.status(201).json({ message: 'Parent registered successfully!' });
  } catch (err) {
    logger.error('Error during registration:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Register Child
export const registerChild = async (req, res) => {
  const { name, parent_id, gender, dob, age, grade, className } = req.body;

  try {
    const parent = await query('SELECT id FROM users WHERE id = ? AND role = ?', [parent_id, 'parent'], 'skydek_DB');
    if (parent.length === 0) {
      return res.status(400).json({ message: 'Parent not found or invalid role.' });
    }

    await execute(
      'INSERT INTO children (name, parent_id, gender, dob, age, grade, className) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, parent_id, gender, dob, age, grade, className]
    );

    res.status(201).json({ message: 'Child registered successfully!' });
  } catch (error) {
    logger.error('Error registering child:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Login
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const users = await query('SELECT * FROM users WHERE email = ?', [email], 'skydek_DB');

    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user, process.env.JWT_SECRET, { expiresIn: '1h' }); // Token with expiry
    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    logger.error('Error during login:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Teacher login
export const teacherLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const rows = await query('SELECT * FROM users WHERE email = ?', [email], 'railway');

    if (!rows || rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const user = rows[0];

    if (!user.password) {
      return res.status(400).json({ message: 'Invalid user data: password missing.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(
      {
        id: user.id,
        role: 'teacher',
        grade: user.grade,
        className: user.className,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        grade: user.grade,
        className: user.className,
      },
    });
  } catch (error) {
    logger.error('Error during teacher login:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
