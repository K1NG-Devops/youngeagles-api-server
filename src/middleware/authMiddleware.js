import { verifyToken } from '../utils/jwt.js';


export const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status().json({ message: 'No token provided.'});

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // includes `id`, `role`, etc.
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

// export const isTeacher = (req, res, next) => {
//   if (req.user.role !== 'teacher') {
//     return res.status(403).json({ message: 'Access denied. Teacher role required.' });
//   }
//   next();
// };

