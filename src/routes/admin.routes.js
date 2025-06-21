import { Router } from 'express';
import { query, execute } from '../db.js';
import { authMiddleware, isAdmin } from '../middleware/authMiddleware.js';
import bcrypt from 'bcryptjs';
import { adminResetTeacherPassword } from '../controllers/passwordResetController.js';

const router = Router();

// Get all teachers
router.get('/teachers', authMiddleware, isAdmin, async (req, res) => {
  try {
    // Use staff table instead of users table for teachers
    const teachers = await query('SELECT id, name, email, className FROM staff WHERE role = ?', ['teacher']);
    res.json(teachers);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Add a new teacher
router.post('/teachers', authMiddleware, isAdmin, async (req, res) => {
  console.log('Creating new teacher with request body:', req.body);
  const { name, email, password, className } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Check if className column exists in staff table first
    let columnExists = false;
    try {
      const columns = await query('SHOW COLUMNS FROM staff LIKE ?', ['className']);
      columnExists = columns.length > 0;
      console.log('className column exists in staff table:', columnExists);
    } catch (columnError) {
      console.error('Error checking for className column:', columnError);
      // Continue without the column check
    }
    
    // Only try to insert className if the column exists
    if (className && columnExists) {
      console.log('Including className in teacher creation');
      await execute(
        'INSERT INTO staff (name, email, password, role, className) VALUES (?, ?, ?, ?, ?)', 
        [name, email, hashedPassword, 'teacher', className]
      );
    } else {
      console.log('Creating teacher without className field');
      await execute(
        'INSERT INTO staff (name, email, password, role) VALUES (?, ?, ?, ?)', 
        [name, email, hashedPassword, 'teacher']
      );
    }
    
    res.status(201).json({ 
      message: 'Teacher added successfully!',
      teacherInfo: { name, email, className, hasClassName: columnExists }
    });
  } catch (error) {
    console.error('Error adding teacher:', error);
    
    // More detailed error logging
    console.error('SQL Error:', error.sqlMessage || 'No SQL message');
    console.error('Error Code:', error.code);
    console.error('Request Body:', req.body);
    
    // Return more helpful error information
    res.status(500).json({ 
      message: 'Server error when creating teacher.',
      details: error.sqlMessage || error.message,
      errorCode: error.code
    });
  }
});

// Update a teacher
router.put('/teachers/:id', authMiddleware, isAdmin, async (req, res) => {
  console.log('Updating teacher ID:', id, 'with request body:', req.body);
  const { id } = req.params;
  const { name, email, password, className } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Name and email are required.' });
  }

  try {
    // Check if className column exists in staff table
    let columnExists = false;
    try {
      const columns = await query('SHOW COLUMNS FROM staff LIKE ?', ['className']);
      columnExists = columns.length > 0;
      console.log('className column exists in staff table:', columnExists);
    } catch (columnError) {
      console.error('Error checking for className column:', columnError);
      // Continue without the column check
    }
    
    // Use staff table instead of users table for teachers
    let updateQuery = 'UPDATE staff SET name = ?, email = ?';
    const params = [name, email];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      updateQuery += ', password = ?';
      params.push(hashedPassword);
    }
    
    // Include className in update if provided and column exists
    if (className !== undefined && columnExists) {
      updateQuery += ', className = ?';
      params.push(className);
    }

    updateQuery += ' WHERE id = ? AND role = ?';
    params.push(id, 'teacher');

    const result = await execute(updateQuery, params);
    console.log('Update result:', result);
    
    res.json({ 
      message: 'Teacher updated successfully!',
      affectedRows: result.affectedRows,
      teacherInfo: { name, email, className, hasClassName: columnExists }
    });
  } catch (error) {
    console.error('Error updating teacher:', error);
    
    // More detailed error logging
    console.error('SQL Error:', error.sqlMessage || 'No SQL message');
    console.error('Error Code:', error.code);
    console.error('Request Body:', req.body);
    
    res.status(500).json({ 
      message: 'Server error when updating teacher.',
      details: error.sqlMessage || error.message,
      errorCode: error.code
    });
  }
});

// Delete a teacher
router.delete('/teachers/:id', authMiddleware, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Use staff table instead of users table for teachers
    await execute('DELETE FROM staff WHERE id = ? AND role = ?', [id, 'teacher']);
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
    // Get parent count (from users table)
    const [parents] = await Promise.all([
      query("SELECT COUNT(*) as count FROM users WHERE role = 'parent'")
    ]);

    // Get teacher count (from staff table)
    const [teachers] = await Promise.all([
      query("SELECT COUNT(*) as count FROM staff WHERE role = 'teacher'")
    ]);

    // Calculate total users (parents + teachers + admins)
    const [admins] = await Promise.all([
      query("SELECT COUNT(*) as count FROM staff WHERE role = 'admin'")
    ]);
    
    const totalUsers = parents[0].count + teachers[0].count + admins[0].count;

    // Get homework and submission counts
    const [homeworks, submissions] = await Promise.all([
      query('SELECT COUNT(*) as count FROM homeworks'),
      query('SELECT COUNT(*) as count FROM submissions')
    ]);

    // Get recent activity by combining parent users and staff (teachers/admins)
    const recentParents = await query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 3');
    const recentStaff = await query('SELECT id, name, email, role, created_at FROM staff ORDER BY created_at DESC LIMIT 3');
    const recentHomeworks = await query('SELECT id, title, created_at FROM homeworks ORDER BY created_at DESC LIMIT 3');

    // Format recent activity
    const recentActivity = [
      ...recentParents.map(u => ({
        type: 'user',
        message: `New parent registered: ${u.name}`,
        timestamp: u.created_at
      })),
      ...recentStaff.map(s => ({
        type: 'staff',
        message: `New ${s.role} added: ${s.name}`,
        timestamp: s.created_at
      })),
      ...recentHomeworks.map(h => ({
        type: 'homework',
        message: `Homework posted: ${h.title}`,
        timestamp: h.created_at
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);

    res.json({
      totalUsers: totalUsers,
      totalTeachers: teachers[0].count,
      totalParents: parents[0].count,
      totalHomeworks: homeworks[0].count,
      totalSubmissions: submissions[0].count,
      systemHealth: 'Good',
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    // Include more error details for debugging
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({ 
      message: 'Error fetching admin dashboard data.', 
      error: error.message 
    });
  }
});

export default router; 