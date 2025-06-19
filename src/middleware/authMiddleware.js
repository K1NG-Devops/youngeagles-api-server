import { verifyToken } from '../utils/jwt.js';


export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  console.log('🔐 Auth middleware called:', {
    method: req.method,
    url: req.url,
    hasAuthHeader: !!authHeader
  });

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    console.log('❌ No valid auth header found');
    return res.status(401).json({ message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  console.log('🎟️ Token extracted, length:', token?.length);

  // Check if token is a valid string
  if (!token || typeof token !== 'string' || token.trim() === '') {
    console.log('❌ Invalid token format');
    return res.status(401).json({ message: 'Invalid token format.' });
  }

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
    console.log('❌ Token verification failed:', {
      error: err.message,
      tokenLength: token?.length,
      tokenType: typeof token
    });
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

export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Admins only.' });
  }
};


