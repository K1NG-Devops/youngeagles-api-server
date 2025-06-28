import express from 'express';
import { PasswordManager, TokenManager } from '../utils/auth.js';
import { db } from '../config/database.js';
import { 
  rateLimiters, 
  validationMiddleware, 
  handleValidationErrors 
} from '../middleware/security.js';

const router = express.Router();

/**
 * User Registration
 */
router.post('/register', 
  rateLimiters.auth,
  [
    validationMiddleware.email,
    validationMiddleware.password,
    validationMiddleware.name,
    validationMiddleware.phone,
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { email, password, name, phone, role = 'parent' } = req.body;

      // Check if user already exists
      const [existingUsers] = await db.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Hash password
      const hashedPassword = await PasswordManager.hashPassword(password);

      // Generate verification token
      const verificationToken = TokenManager.generateToken();

      // Insert new user
      const [result] = await db.execute(
        `INSERT INTO users (email, password, name, phone, role, verification_token, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [email, hashedPassword, name, phone, role, verificationToken]
      );

      // Generate API key for the user
      const apiKey = TokenManager.generateApiKey();
      await db.execute(
        'INSERT INTO api_keys (user_id, api_key, created_at) VALUES (?, ?, NOW())',
        [result.insertId, apiKey]
      );

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please verify your email.',
        data: {
          userId: result.insertId,
          email,
          name,
          role,
          verificationRequired: true
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during registration'
      });
    }
  }
);

/**
 * User Login
 */
router.post('/login',
  rateLimiters.auth,
  [
    validationMiddleware.email,
    validationMiddleware.text('password', 1, 255),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Get user from database
      const [users] = await db.execute(
        'SELECT id, email, password, name, role, email_verified, is_active FROM users WHERE email = ?',
        [email]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const user = users[0];

      // Check if account is active
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Account is disabled. Please contact support.'
        });
      }

      // Verify password
      const isValidPassword = await PasswordManager.verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate session token
      const sessionToken = TokenManager.generateSessionToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store session in database
      await db.execute(
        'INSERT INTO user_sessions (user_id, session_token, expires_at, created_at) VALUES (?, ?, ?, NOW())',
        [user.id, sessionToken, expiresAt]
      );

      // Update last login
      await db.execute(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [user.id]
      );

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            emailVerified: user.email_verified
          },
          session: {
            token: sessionToken,
            expiresAt
          }
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during login'
      });
    }
  }
);

/**
 * User Logout
 */
router.post('/logout', async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (sessionToken) {
      // Invalidate session in database
      await db.execute(
        'DELETE FROM user_sessions WHERE session_token = ?',
        [sessionToken]
      );
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
});

/**
 * Email Verification
 */
router.post('/verify-email',
  [
    validationMiddleware.text('token', 32, 32),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { token } = req.body;

      // Find user with this verification token
      const [users] = await db.execute(
        'SELECT id, email, name FROM users WHERE verification_token = ? AND email_verified = 0',
        [token]
      );

      if (users.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token'
        });
      }

      const user = users[0];

      // Mark email as verified
      await db.execute(
        'UPDATE users SET email_verified = 1, verification_token = NULL, verified_at = NOW() WHERE id = ?',
        [user.id]
      );

      res.json({
        success: true,
        message: 'Email verified successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: true
          }
        }
      });

    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during email verification'
      });
    }
  }
);

/**
 * Password Reset Request
 */
router.post('/forgot-password',
  rateLimiters.passwordReset,
  [
    validationMiddleware.email,
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { email } = req.body;

      // Check if user exists
      const [users] = await db.execute(
        'SELECT id, name FROM users WHERE email = ? AND is_active = 1',
        [email]
      );

      // Always return success to prevent email enumeration
      if (users.length === 0) {
        return res.json({
          success: true,
          message: 'If an account with this email exists, a password reset link has been sent.'
        });
      }

      const user = users[0];

      // Generate reset token
      const resetToken = TokenManager.generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token
      await db.execute(
        'INSERT INTO password_resets (user_id, reset_token, expires_at, created_at) VALUES (?, ?, ?, NOW())',
        [user.id, resetToken, expiresAt]
      );

      // Here you would typically send an email with the reset link
      // For now, we'll just log it (remove in production)
      console.log(`Password reset token for ${email}: ${resetToken}`);

      res.json({
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.'
      });

    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during password reset request'
      });
    }
  }
);

/**
 * Password Reset Confirmation
 */
router.post('/reset-password',
  rateLimiters.auth,
  [
    validationMiddleware.text('token', 32, 32),
    validationMiddleware.password,
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { token, password } = req.body;

      // Find valid reset token
      const [resets] = await db.execute(
        `SELECT pr.user_id, u.email 
         FROM password_resets pr 
         JOIN users u ON pr.user_id = u.id 
         WHERE pr.reset_token = ? AND pr.expires_at > NOW() AND pr.used = 0`,
        [token]
      );

      if (resets.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      const reset = resets[0];

      // Hash new password
      const hashedPassword = await PasswordManager.hashPassword(password);

      // Update password
      await db.execute(
        'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
        [hashedPassword, reset.user_id]
      );

      // Mark reset token as used
      await db.execute(
        'UPDATE password_resets SET used = 1, used_at = NOW() WHERE reset_token = ?',
        [token]
      );

      // Invalidate all existing sessions for this user
      await db.execute(
        'DELETE FROM user_sessions WHERE user_id = ?',
        [reset.user_id]
      );

      res.json({
        success: true,
        message: 'Password reset successfully. Please log in with your new password.'
      });

    } catch (error) {
      console.error('Password reset confirmation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during password reset'
      });
    }
  }
);

/**
 * Change Password (for logged-in users)
 */
router.post('/change-password',
  [
    validationMiddleware.text('currentPassword', 1, 255),
    validationMiddleware.password.withMessage('New password must meet security requirements'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { currentPassword, password: newPassword } = req.body;
      const sessionToken = req.headers.authorization?.replace('Bearer ', '');

      if (!sessionToken) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Get user from session
      const [sessions] = await db.execute(
        `SELECT s.user_id, u.password 
         FROM user_sessions s 
         JOIN users u ON s.user_id = u.id 
         WHERE s.session_token = ? AND s.expires_at > NOW()`,
        [sessionToken]
      );

      if (sessions.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired session'
        });
      }

      const session = sessions[0];

      // Verify current password
      const isValidPassword = await PasswordManager.verifyPassword(currentPassword, session.password);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const hashedNewPassword = await PasswordManager.hashPassword(newPassword);

      // Update password
      await db.execute(
        'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
        [hashedNewPassword, session.user_id]
      );

      // Invalidate all other sessions for this user (keep current session)
      await db.execute(
        'DELETE FROM user_sessions WHERE user_id = ? AND session_token != ?',
        [session.user_id, sessionToken]
      );

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during password change'
      });
    }
  }
);

export default router;
