import { verifyToken } from '../utils/jwt.js';


export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // includes `id`, `role`, etc.
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

export const isTeacher = (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied. Teacher role required.' });
  }
  next();
};

