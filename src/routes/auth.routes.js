import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

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

// Change Password - for logged-in users
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    const userType = req.user.userType;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    // Get user from appropriate table based on userType
    let user;
    if (userType === 'parent') {
      const [parent] = await query('SELECT * FROM users WHERE id = ?', [userId]);
      user = parent;
    } else if (userType === 'teacher' || userType === 'admin') {
      const [staff] = await query('SELECT * FROM staff WHERE id = ?', [userId]);
      user = staff;
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidCurrentPassword) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password in appropriate table
    if (userType === 'parent') {
      await query(
        'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
        [hashedNewPassword, userId]
      );
    } else if (userType === 'teacher' || userType === 'admin') {
      await query(
        'UPDATE staff SET password = ?, updated_at = NOW() WHERE id = ?',
        [hashedNewPassword, userId]
      );
    }

    console.log(`Password changed successfully for ${userType} user ID: ${userId}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;

    let user;
    if (userType === 'parent') {
      const [parentUser] = await query(
        'SELECT id, name, email, phone, address, profile_picture, created_at, updated_at FROM users WHERE id = ?',
        [userId]
      );
      user = parentUser;
    } else if (userType === 'teacher' || userType === 'admin') {
      const [staffUser] = await query(
        'SELECT id, name, email, role, profile_picture, created_at, updated_at FROM staff WHERE id = ?',
        [userId]
      );
      user = staffUser;
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Normalize profile picture fields
    const normalizedUser = {
      ...user,
      profilePicture: user.profile_picture,
      profile_picture: user.profile_picture,
      avatar: user.profile_picture,
      image: user.profile_picture,
      userType: userType
    };

    res.json({
      success: true,
      user: normalizedUser
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
      message: error.message
    });
  }
});

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

// Admin Login - Rebuilt with comprehensive debugging
router.post('/admin-login', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`\n🔐 [${requestId}] Admin login attempt started`);
  console.log(`🔐 [${requestId}] Request body:`, { 
    username: req.body.username, 
    passwordProvided: !!req.body.password,
    passwordLength: req.body.password?.length || 0
  });

  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      console.log(`❌ [${requestId}] Missing credentials - username: ${!!username}, password: ${!!password}`);
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    console.log(`🔍 [${requestId}] Searching for admin with email: ${username}`);
    
    // Find admin by email (username) with detailed logging
    const adminResults = await query(
      'SELECT * FROM staff WHERE email = ? AND role = "admin"',
      [username]
    );
    
    console.log(`📊 [${requestId}] Database query results:`, {
      totalResults: adminResults.length,
      foundAdmin: adminResults.length > 0
    });

    if (adminResults.length === 0) {
      console.log(`❌ [${requestId}] No admin found with email: ${username}`);
      
      // Additional debug: Check if user exists in any role
      const anyUserResults = await query(
        'SELECT email, role FROM staff WHERE email = ?',
        [username]
      );
      console.log(`🔍 [${requestId}] User exists with other roles:`, anyUserResults);
      
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const [admin] = adminResults;
    console.log(`✅ [${requestId}] Admin found:`, {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      hasPassword: !!admin.password,
      passwordLength: admin.password?.length || 0,
      passwordStartsWith: admin.password?.substring(0, 4) || 'none'
    });

    // Validate password format
    if (!admin.password) {
      console.log(`❌ [${requestId}] Admin has no password set`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if password looks like a bcrypt hash
    const isBcryptHash = admin.password.startsWith('$2b$') || admin.password.startsWith('$2a$') || admin.password.startsWith('$2y$');
    console.log(`🔐 [${requestId}] Password format check - Is bcrypt hash: ${isBcryptHash}`);

    // Check password
    console.log(`🔐 [${requestId}] Comparing password...`);
    let isValidPassword;
    try {
      isValidPassword = await bcrypt.compare(password, admin.password);
      console.log(`🔐 [${requestId}] Password comparison result: ${isValidPassword}`);
    } catch (bcryptError) {
      console.error(`❌ [${requestId}] Bcrypt comparison error:`, bcryptError);
      return res.status(500).json({
        success: false,
        error: 'Authentication error'
      });
    }

    if (!isValidPassword) {
      console.log(`❌ [${requestId}] Invalid password for admin: ${username}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    console.log(`✅ [${requestId}] Password validated successfully`);

    // Generate token
    console.log(`🎟️ [${requestId}] Generating JWT token...`);
    let token;
    try {
      token = generateToken({
        id: admin.id,
        email: admin.email,
        userType: 'admin'
      });
      console.log(`✅ [${requestId}] JWT token generated successfully`);
    } catch (tokenError) {
      console.error(`❌ [${requestId}] Token generation error:`, tokenError);
      return res.status(500).json({
        success: false,
        error: 'Authentication error'
      });
    }

    // Prepare user data (without password)
    const { password: _adminPassword, ...userData } = admin;
    const responseData = {
      success: true,
      token,
      user: {
        ...userData,
        userType: 'admin'
      }
    };

    console.log(`✅ [${requestId}] Admin login successful for:`, {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      userType: 'admin'
    });

    res.json(responseData);

  } catch (error) {
    console.error(`❌ [${requestId}] Admin login error:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errno: error.errno
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      requestId: requestId // Include request ID for debugging
    });
  }
});

export default router; 