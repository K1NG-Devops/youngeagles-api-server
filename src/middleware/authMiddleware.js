import { verifyToken } from '../utils/jwt.js';


export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  console.log('🔐 Auth middleware called:', {
    method: req.method,
    url: req.url,
    hasAuthHeader: !!authHeader,
    nodeEnv: process.env.NODE_ENV
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('🚧 Development mode: bypassing auth');
    req.user = { id: 1, email:'test@youngeagles.org.za', role: 'teacher'};
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ No valid auth header found');
    return res.status(401).json({ message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  console.log('🎟️ Token extracted, length:', token?.length);

  try {
    const decoded = verifyToken(token);
    console.log('✅ Token verified successfully:', {
      userId: decoded.id,
      role: decoded.role,
      email: decoded.email
    });
    req.user = decoded; // includes `id`, `role`, etc.
    next();
  } catch (err) {
    console.log('❌ Token verification failed:', err.message);
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

export const isTeacher = (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied. Teacher role required.' });
  }
  next();
};

export const isTeacherOrAdmin = (req, res, next) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Teacher or admin role required.' });
  }
  next();
};


