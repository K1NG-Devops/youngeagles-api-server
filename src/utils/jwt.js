import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Validate required JWT secrets
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET || process.env.JWT_SECRET; // Use JWT_SECRET as fallback

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET environment variable is required');
  console.error('🚨 Please set JWT_SECRET in your environment variables');
  process.exit(1);
}

if (JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET must be at least 32 characters long');
  console.error('🚨 Current length:', JWT_SECRET.length);
  process.exit(1);
}

// Function to generate an access token
export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      grade: user.grade,       // Optional
      className: user.className,
      teacherId: user.teacherId || user.id,  // Ensure teacherId exists
    },
    JWT_SECRET,
    { expiresIn: '24h' }  // Increased to 24 hours
  );
};

// Function to generate a refresh token
export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
    },
    REFRESH_SECRET,
    { expiresIn: '7d' }  // 7 days
  );
};

// Function to verify access token
export const verifyToken = (token) => {
  try {
  return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Token verification failed:', error.message);
    throw error;
  }
};

// Function to verify refresh token
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, REFRESH_SECRET);
  } catch (error) {
    console.error('Refresh token verification failed:', error.message);
    throw error;
  }
};
