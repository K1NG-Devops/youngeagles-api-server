import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// JWT Secret - should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // Increased to 7 days for better UX

// Password Security
export class PasswordSecurity {
  static async hashPassword(password) {
    try {
      const saltRounds = 10;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      console.error('Error hashing password:', error);
      throw error;
    }
  }

  static async verifyPassword(password, hashedPassword) {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      console.error('Error verifying password:', error);
      throw error;
    }
  }
}

// Token Manager
export class TokenManager {
  static generateToken(payload) {
    try {
      return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    } catch (error) {
      console.error('Error generating token:', error);
      throw error;
    }
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      console.error('Error verifying token:', error);
      throw error;
    }
  }

  static refreshToken(token) {
    try {
      // Decode without verification to get payload
      const decoded = jwt.decode(token);
      if (!decoded) {
        throw new Error('Invalid token format');
      }
      
      // Generate new token with same payload (excluding exp, iat)
      const { exp, iat, ...payload } = decoded;
      return this.generateToken(payload);
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }
}

// Auth middleware with better error handling
export const verifyTokenMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'No authorization header provided',
        code: 'NO_AUTH_HEADER'
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({ 
        error: 'No token provided',
        code: 'NO_TOKEN'
      });
    }

    try {
      const decoded = TokenManager.verifyToken(token);
      req.user = decoded;
      next();
    } catch (tokenError) {
      console.error('Token verification failed:', tokenError);
      
      // Check if it's specifically a token expiration error
      if (tokenError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token has expired',
          code: 'TOKEN_EXPIRED',
          expiredAt: tokenError.expiredAt
        });
      }
      
      // Check if it's a JSON Web Token error
      if (tokenError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }
      
      // Generic token error
      return res.status(401).json({ 
        error: 'Token verification failed',
        code: 'TOKEN_VERIFICATION_FAILED'
      });
    }
  } catch (error) {
    console.error('Middleware error:', error);
    return res.status(500).json({ 
      error: 'Internal server error during authentication',
      code: 'INTERNAL_ERROR'
    });
  }
}; 