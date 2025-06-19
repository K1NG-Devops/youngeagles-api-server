import { query, execute } from '../db.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/jwt.js';
import { validationResult } from 'express-validator';
import dotenv from 'dotenv';
import winston from 'winston';
import Event from '../models/events.js';
import admin from '../config/firebase-admin.js';

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
    
    // Prepare parameters - workAddress can be null, but other fields are required
    const params = [
      name,
      email,
      phone,
      address,
      workAddress || null,
      hashedPassword,
      role
    ];
    
    await execute(
      'INSERT INTO users (name, email, phone, address, workaddress, password, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params,
      'skydek_DB'
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

    // Convert undefined values to null to prevent MySQL2 errors
    const params = [
      name || null,
      parent_id || null,
      gender || null,
      dob || null,
      age || null,
      grade || null,
      className || null
    ];

    await execute(
      'INSERT INTO children (name, parent_id, gender, dob, age, grade, className) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params,
      'skydek_DB'
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

    const token = generateToken(user); // Token with expiry
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
    // Use staff table for teachers
    let rows = await query('SELECT * FROM staff WHERE email = ? AND role = "teacher"', [email], 'skydek_DB');

    if (!rows || rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const user = rows[0];

    // Ensure user has role of teacher
    if (user.role !== 'teacher') {
      return res.status(403).json({ message: 'Access denied. Teacher role required.' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'Invalid user data: password missing.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'teacher',
    });

    res.status(200).json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'teacher',
      },
    });
  } catch (error) {
    logger.error('Error during teacher login:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Admin Login
export const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const rows = await query('SELECT * FROM staff WHERE email = ? AND role = "admin"', [email], 'skydek_DB');

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

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'admin',
    });

    res.status(200).json({
      message: 'Login successful!',
      accessToken: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error during admin login:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Add this function
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const event = await Event.findByPk(id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    await event.update(updates);
    res.json({ message: 'Event updated', event });
  } catch (error) {
    res.status(500).json({ message: 'Error updating event', error: error.message });
  }
};

// Firebase authentication endpoint
export const firebaseLogin = async (req, res) => {
  try {
    const { email, phone, uid, displayName } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Firebase ID token required' });
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify Firebase ID token
    let decodedToken;
    
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
      
      // Check if email is verified (for email-based authentication)
      if (email && !decodedToken.email_verified) {
        return res.status(403).json({ 
          message: 'Email not verified. Please verify your email before signing in.',
          code: 'EMAIL_NOT_VERIFIED'
        });
      }
      
    } catch (error) {
      console.error('Firebase token verification failed:', error);
      return res.status(401).json({ message: 'Invalid Firebase token' });
    }
    
    // Check if user exists in database
    let user;
    const identifier = email || phone;
    
    if (email) {
      const existingUsers = await query(
        'SELECT * FROM users WHERE email = ?',
        [email],
        'skydek_DB'
      );
      user = existingUsers[0];
    } else if (phone) {
      const existingUsers = await query(
        'SELECT * FROM users WHERE phone = ?',
        [phone],
        'skydek_DB'
      );
      user = existingUsers[0];
    }
    
    // If user doesn't exist, create new user
    if (!user) {
      const insertSql = `
        INSERT INTO users (email, phone, name, role, firebase_uid, password)
        VALUES (?, ?, ?, 'parent', ?, 'firebase_auth')
      `;
      
      const result = await execute(insertSql, [
        email || null,
        phone || null,
        displayName || 'User',
        uid
      ], 'skydek_DB');
      
      // Fetch the newly created user
      const newUsers = await query(
        'SELECT * FROM users WHERE id = ?',
        [result.insertId],
        'skydek_DB'
      );
      user = newUsers[0];
    } else {
      // Update existing user with Firebase UID if not set
      if (!user.firebase_uid) {
        await execute(
          'UPDATE users SET firebase_uid = ? WHERE id = ?',
          [uid, user.id],
          'skydek_DB'
        );
        user.firebase_uid = uid;
      }
    }
    
    // Generate JWT token for your system
    const token = generateToken({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role: 'parent'
    });
    
    res.status(200).json({
      message: 'Firebase authentication successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: 'parent'
      }
    });
    
  } catch (error) {
    console.error('Firebase login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

