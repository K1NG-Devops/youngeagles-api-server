import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, execute } from '../db.js';
import { body, validationResult } from 'express-validator';
import { generateToken, verifyToken } from '../utils/jwt.js';

const router = Router();

// ✅ POST /auth/register
router.post('/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Invalid email format'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('address').notEmpty().withMessage('Address is required'),
  body('workAddress').optional(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, phone, password, address, workAddress } = req.body;
  const role = 'parent';

  try {
    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await execute(
      'INSERT INTO users (name, email, phone, address, work_address, password, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone, address, workAddress, hashedPassword, role]
    );

    res.status(201).json({ message: 'Parent registered successfully!' });
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ✅ POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const users = await query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }
    
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    // Generate JWT token
    const token = generateToken(user);
    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

router.get('/dashboard', verifyToken, (req, res) => {
  res.json({ name: req.user.name });
});

// ✅ GET /auth/profile
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
// ✅ PUT /auth/profile
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
