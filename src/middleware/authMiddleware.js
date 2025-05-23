import { verifyToken } from '../utils/jwt.js'; // Adjust this path if needed

export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided or invalid format' });
    }

    const token = authHeader.split(' ')[1];

    const decoded = verifyToken(token); // Should return decoded user info

    req.user = decoded; // Attach user data to request
    next();
  } catch (err) {
    console.error('Auth Error:', err.message);
    return res.status(401).json({ message: 'Unauthorized access' });
  }
};
