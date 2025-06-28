/**
 * Young Eagles API Security Utilities
 * Consolidated security functions for authentication and authorization
 * Using crypto-based implementation from the original codebase
 */

import crypto from 'crypto';

// Password security utilities (using crypto-based implementation from backup)
export class PasswordSecurity {
  /**
   * Validate password strength
   */
  static validatePassword(password) {
    if (!password || password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasUpperCase) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!hasLowerCase) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!hasNumbers) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    if (!hasSpecialChar) {
      return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)' };
    }
    
    return { valid: true, message: 'Password meets security requirements' };
  }
  
  /**
   * Hash password using crypto (original implementation from backup)
   */
  static hashPassword(password) {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }
  
  /**
   * Verify password against hash using crypto (original implementation from backup)
   */
  static verifyPassword(password, hashedPassword) {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  /**
   * Generate a secure random password
   */
  static generateSecurePassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
}

// Token management utilities (using custom JWT-like implementation from backup)
export class TokenManager {
  /**
   * Generate JWT-like token (original implementation from backup)
   */
  static generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };
    
    const secret = crypto.randomBytes(32).toString('hex');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto.createHmac('sha256', secret).update(`${header}.${payloadEncoded}`).digest('base64');
    
    return `${header}.${payloadEncoded}.${signature}`;
  }

  /**
   * Verify JWT-like token (original implementation from backup)
   */
  static verifyToken(tokenString) {
    try {
      if (!tokenString) return null;
      
      const parts = tokenString.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        console.log('❌ Token expired');
        return null;
      }
      
      return payload;
    } catch (error) {
      console.log('❌ Token verification failed:', error.message);
      return null;
    }
  }

  /**
   * Generate secure random token for other purposes
   */
  static generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate API key
   */
  static generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate session token
   */
  static generateSessionToken() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate verification code (numeric)
   */
  static generateVerificationCode(length = 6) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

/**
 * Verify token from HTTP request (original implementation from backup)
 * This is the main function used by the index.js file
 */
export function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  return TokenManager.verifyToken(token);
} 