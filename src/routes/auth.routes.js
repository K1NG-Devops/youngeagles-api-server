import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, execute } from '../db.js';
import { body, validationResult } from 'express-validator';
import { generateToken, verifyToken } from '../utils/jwt.js';
import { registerChild, registerUser, loginUser } from '../controllers/authController.js';
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
