import { Router } from 'express';
import { query, execute } from '../db.js';
import { authMiddleware, isAdmin } from '../middleware/authMiddleware.js';
import bcrypt from 'bcryptjs';
import { adminResetTeacherPassword } from '../controllers/passwordResetController.js';

const router = Router();

// Get all teachers
router.get('/teachers', authMiddleware, isAdmin, async (req, res) => {
  try {
    const teachers = await query('SELECT id, name, email FROM users WHERE role = ?', ['teacher']);
    res.json(teachers);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Add a new teacher
router.post('/teachers', authMiddleware, isAdmin, async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    await execute('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hashedPassword, 'teacher']);
    res.status(201).json({ message: 'Teacher added successfully!' });
  } catch (error) {
    console.error('Error adding teacher:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Update a teacher
router.put('/teachers/:id', authMiddleware, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, password } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Name and email are required.' });
  }

  try {
    let updateQuery = 'UPDATE users SET name = ?, email = ?';
    const params = [name, email];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      updateQuery += ', password = ?';
      params.push(hashedPassword);
    }

    updateQuery += ' WHERE id = ? AND role = ?';
    params.push(id, 'teacher');

    await execute(updateQuery, params);
    res.json({ message: 'Teacher updated successfully!' });
  } catch (error) {
    console.error('Error updating teacher:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Delete a teacher
router.delete('/teachers/:id', authMiddleware, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await execute('DELETE FROM users WHERE id = ? AND role = ?', [id, 'teacher']);
    res.json({ message: 'Teacher deleted successfully!' });
  } catch (error) {
    console.error('Error deleting teacher:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get all parents
router.get('/parents', authMiddleware, isAdmin, async (req, res) => {
  try {
    const parents = await query('SELECT id, name, email FROM users WHERE role = ?', ['parent']);
    res.json(parents);
  } catch (error) {
    console.error('Error fetching parents:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Add a new parent
router.post('/parents', authMiddleware, isAdmin, async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    await execute('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hashedPassword, 'parent']);
    res.status(201).json({ message: 'Parent added successfully!' });
  } catch (error) {
    console.error('Error adding parent:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Update a parent
router.put('/parents/:id', authMiddleware, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, password } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Name and email are required.' });
  }

  try {
    let updateQuery = 'UPDATE users SET name = ?, email = ?';
    const params = [name, email];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      updateQuery += ', password = ?';
      params.push(hashedPassword);
    }

    updateQuery += ' WHERE id = ? AND role = ?';
    params.push(id, 'parent');

    await execute(updateQuery, params);
    res.json({ message: 'Parent updated successfully!' });
  } catch (error) {
    console.error('Error updating parent:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Delete a parent
router.delete('/parents/:id', authMiddleware, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await execute('DELETE FROM users WHERE id = ? AND role = ?', [id, 'parent']);
    res.json({ message: 'Parent deleted successfully!' });
  } catch (error) {
    console.error('Error deleting parent:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Reset teacher password (admin only)
router.post('/teachers/:teacherId/reset-password', authMiddleware, isAdmin, adminResetTeacherPassword);

// Admin dashboard summary endpoint
router.get('/dashboard', authMiddleware, isAdmin, async (req, res) => {
  try {
    // Get user counts
    const [users, teachers, parents] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users'),
      query("SELECT COUNT(*) as count FROM users WHERE role = 'teacher'"),
      query("SELECT COUNT(*) as count FROM users WHERE role = 'parent'")
    ]);

    // Get homework and submission counts
    const [homeworks, submissions] = await Promise.all([
      query('SELECT COUNT(*) as count FROM homeworks'),
      query('SELECT COUNT(*) as count FROM homework_submissions')
    ]);

    // Get recent activity (last 5 users and last 5 homeworks)
    const recentUsers = await query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5');
    const recentHomeworks = await query('SELECT id, title, created_at FROM homeworks ORDER BY created_at DESC LIMIT 5');

    // Format recent activity
    const recentActivity = [
      ...recentUsers.map(u => ({
        type: 'user',
        message: `New ${u.role} registered: ${u.name}`,
        timestamp: u.created_at
      })),
      ...recentHomeworks.map(h => ({
        type: 'homework',
        message: `Homework posted: ${h.title}`,
        timestamp: h.created_at
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);

    res.json({
      totalUsers: users[0].count,
      totalTeachers: teachers[0].count,
      totalParents: parents[0].count,
      totalHomeworks: homeworks[0].count,
      totalSubmissions: submissions[0].count,
      systemHealth: 'Good',
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

export default router; 