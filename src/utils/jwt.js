import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'defaultsecret';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'refreshsecret';

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
