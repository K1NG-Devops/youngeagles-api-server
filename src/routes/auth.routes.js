import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, execute } from '../db.js';
import { body, validationResult } from 'express-validator';
import { generateToken, verifyToken } from '../utils/jwt.js';
import { registerChild, registerUser, loginUser, teacherLogin, adminLogin, firebaseLogin } from '../controllers/authController.js';
import { getChildrenByTeacher } from '../controllers/teacherController.js';
import { getChildrenForParent } from '../controllers/parentController.js';
import { authMiddleware, isTeacher } from '../middleware/authMiddleware.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

// import { isAdmin } from '../middleware/roleMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upload = multer({ dest: 'uploads/' });

const router = Router();

// /auth/register
router.post('/register',
  [
    body('email').isEmail().withMessage('Invalid email format.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  registerUser
);

// /auth/register-child
router.post('/register-child',
  [
    body('name').notEmpty().withMessage('Child name is required.'),
    body('parent_id').isInt().withMessage('Valid parent ID is required.'),
    body('gender').notEmpty().withMessage('Gender is required.'),
    body('dob').notEmpty().withMessage('Date of birth is required.'),
    body('age').optional().isInt({ min: 1 }).withMessage('Age must be a number.'),
    body('grade').optional().isString(),
    body('className').optional().isString(),
  ],
  (req, res, next) => {
    console.log('Request body:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  registerChild
);

// ✅ POST /auth/login
router.post('/login',
  [
    body('email').isEmail().withMessage('Email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  loginUser
);

// ✅ POST /auth/teacher-login
router.post('/teacher-login',
  [
    body('email').isEmail().withMessage('Email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  teacherLogin
);

// ✅ POST /auth/admin-login
router.post('/admin-login',
  [
    body('email').isEmail().withMessage('Email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  adminLogin
);


// Firebase authentication route
router.post('/firebase-login', firebaseLogin);

router.get('/children', authMiddleware, isTeacher, getChildrenByTeacher)

// GET /auth/parent/children (for parents to fetch their children)
router.get('/parent/children', authMiddleware, getChildrenForParent);

// GET /auth/parents/:id/children - Get children for a specific parent
router.get('/parents/:id/children', async (req, res) => {
  const { id: parentId } = req.params;
  
  try {
    console.log('Fetching children for parent ID:', parentId);
    
    // Verify parent exists
    const parent = await query(
      'SELECT id FROM users WHERE id = ? AND role = ?', 
      [parentId, 'parent'], 
      'skydek_DB'
    );
    
    if (parent.length === 0) {
      return res.status(404).json({ message: 'Parent not found.' });
    }
    
    // Fetch children for this parent
    const children = await query(
      'SELECT id, name, gender, dob, age, grade, className, parent_id FROM children WHERE parent_id = ?',
      [parentId],
      'skydek_DB'
    );
    
    console.log('Children found:', children);
    
    // Split name into first_name and last_name for compatibility
    const formattedChildren = children.map(child => ({
      ...child,
      first_name: child.name ? child.name.split(' ')[0] : '',
      last_name: child.name ? child.name.split(' ').slice(1).join(' ') : ''
    }));
    
    res.json(formattedChildren);
  } catch (err) {
    console.error('Error fetching children for parent:', err);
    res.status(500).json({ message: 'Server error fetching children.' });
  }
});

// DEBUG: Get all parents and children for debugging
router.get('/debug/data', async (req, res) => {
  try {
    // Get all parents
    const parents = await query(
      'SELECT id, name, email, role FROM users WHERE role = "parent" LIMIT 10',
      [],
      'skydek_DB'
    );
    
    // Get all teachers from both databases
    const teachersSkydek = await query(
      'SELECT id, name, email, role FROM users WHERE role = "teacher" LIMIT 10',
      [],
      'skydek_DB'
    );
    
    const teachersRailway = await query(
      'SELECT id, name, email, role FROM users LIMIT 10',
      [],
      'railway'
    );
    
    // Get all children
    const children = await query(
      'SELECT id, name, parent_id, className FROM children LIMIT 10',
      [],
      'skydek_DB'
    );
    
    res.json({
      message: 'Debug data retrieved',
      parents,
      teachersSkydek,
      teachersRailway,
      children,
      parentCount: parents.length,
      teacherCountSkydek: teachersSkydek.length,
      teacherCountRailway: teachersRailway.length,
      childrenCount: children.length
    });
  } catch (err) {
    console.error('Error fetching debug data:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// /auth/profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const rows = await query('SELECT id, name, email, phone FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});
// /auth/profile
router.put('/profile', verifyToken, async (req, res) => {
  const { name, email, phone } = req.body;
  const userId = req.user.id;

  if (!name || !email || !phone) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    await execute(
      'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?',
      [name, email, phone, userId]
    );
    res.json({ message: 'Profile updated successfully!' });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});
// ✅ POST /auth/forgot-password
// ✅ POST /auth/reset-password

// ✅ GET /auth/users (for admin/testing)
router.get('/users', verifyToken, async (req, res) => {
  try {
    const users = await query('SELECT id, name, email FROM users');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Error fetching users.' });
  }
});

// ✅ DELETE /auth/users/:id (for admin/testing)
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'User ID is required.' });
  }

  try {
    const result = await execute('DELETE FROM users WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ message: 'User deleted successfully!' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});
// ✅ PUT /auth/users/:id (for admin/testing)
router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, password } = req.body;

  if (!id || !name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await execute(
      'UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?',
      [name, email, hashedPassword, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ message: 'User updated successfully!' });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ✅ GET /auth/users/:id (for admin/testing)
router.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await query(
      'SELECT id, name, email FROM users WHERE id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ✅ logout route
router.post('/logout', verifyToken, (req, res) => {
  // Invalidate the token on the client side
  res.json({ message: 'Logged out successfully!' });
});
// ✅ refresh token route

export default router;
