import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      userType: user.userType 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Parent Login
router.post('/parent-login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Find parent by email (username)
    const [parent] = await query(
      'SELECT * FROM users WHERE email = ? AND role = "parent"',
      [username]
    );

    if (!parent) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, parent.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken({
      id: parent.id,
      email: parent.email,
      userType: 'parent'
    });

    // Return user data (without password)
    const { password: _parentPassword, ...userData } = parent;

    res.json({
      success: true,
      token,
      user: {
        ...userData,
        userType: 'parent'
      }
    });

  } catch (error) {
    console.error('Parent login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Teacher Login
router.post('/teacher-login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Find teacher by email (username)
    const [teacher] = await query(
      'SELECT * FROM staff WHERE email = ? AND role = "teacher"',
      [username]
    );

    if (!teacher) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, teacher.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken({
      id: teacher.id,
      email: teacher.email,
      userType: 'teacher'
    });

    // Return user data (without password)
    const { password: _teacherPassword, ...userData } = teacher;

    res.json({
      success: true,
      token,
      user: {
        ...userData,
        userType: 'teacher'
      }
    });

  } catch (error) {
    console.error('Teacher login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Admin Login
router.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Find admin by email (username)
    const [admin] = await query(
      'SELECT * FROM staff WHERE email = ? AND role = "admin"',
      [username]
    );

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken({
      id: admin.id,
      email: admin.email,
      userType: 'admin'
    });

    // Return user data (without password)
    const { password: _adminPassword, ...userData } = admin;

    res.json({
      success: true,
      token,
      user: {
        ...userData,
        userType: 'admin'
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router; 