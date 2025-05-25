import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'defaultsecret';

// Function to generate a token
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
    { expiresIn: '1h' }
  );
};

// Function to verify token and return decoded payload
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};
