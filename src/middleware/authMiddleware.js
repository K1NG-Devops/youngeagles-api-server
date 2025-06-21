import { verifyToken } from '../utils/jwt.js';

// List of routes that should skip auth
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/public',
  '/health',
  '/manifest.json'
];

// List of routes that should skip redirect on auth failure
const SKIP_REDIRECT_ROUTES = [
  '/api/auth/verify',
  '/api/homework',
  '/api/children',
  '/api/reports/parent'
];

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const currentPath = req.path;
  
  console.log('🔐 Auth middleware called:', {
    method: req.method,
    url: req.url,
    path: currentPath,
    hasAuthHeader: !!authHeader
  });

  // Skip auth for public routes
  if (PUBLIC_ROUTES.some(route => currentPath.startsWith(route))) {
    console.log('📢 Skipping auth for public route:', currentPath);
    return next();
  }

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    console.log('❌ No valid auth header found');
    return res.status(401).json({ 
      message: 'No token provided.',
      shouldRedirect: !SKIP_REDIRECT_ROUTES.some(route => currentPath.includes(route))
    });
  }

  const token = authHeader.split(' ')[1];
  console.log('🎟️ Token extracted, length:', token?.length);

  // Check if token is a valid string
  if (!token || typeof token !== 'string' || token.trim() === '') {
    console.log('❌ Invalid token format');
    return res.status(401).json({ 
      message: 'Invalid token format.',
      shouldRedirect: !SKIP_REDIRECT_ROUTES.some(route => currentPath.includes(route))
    });
  }

  try {
    const decoded = verifyToken(token);
    console.log('✅ Token verified successfully:', {
      userId: decoded.id,
      role: decoded.role,
      email: decoded.email,
      path: currentPath
    });
    req.user = decoded; // includes `id`, `role`, etc.
    next();
  } catch (err) {
    console.log('❌ Token verification failed:', {
      error: err.message,
      tokenLength: token?.length,
      tokenType: typeof token,
      path: currentPath
    });
    return res.status(401).json({ 
      message: 'Invalid token.',
      shouldRedirect: !SKIP_REDIRECT_ROUTES.some(route => currentPath.includes(route))
    });
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


