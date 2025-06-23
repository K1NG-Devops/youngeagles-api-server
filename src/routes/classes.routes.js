const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/authMiddleware');
const localAuthMiddleware = require('../middleware/localAuthMiddleware');

// Get all classes
router.get('/', localAuthMiddleware, async (req, res) => {
  try {
    const classes = await db.all(`
      SELECT 
        c.*,
        u.name as teacher_name,
        COUNT(DISTINCT s.id) as student_count
      FROM classes c
      LEFT JOIN users u ON c.teacher_id = u.id
      LEFT JOIN student_classes sc ON c.id = sc.class_id
      LEFT JOIN students s ON sc.student_id = s.id
      GROUP BY c.id
      ORDER BY c.name
    `);

    res.json(classes || []);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Get single class
router.get('/:id', localAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const classData = await db.get(`
      SELECT 
        c.*,
        u.name as teacher_name,
        u.email as teacher_email
      FROM classes c
      LEFT JOIN users u ON c.teacher_id = u.id
      WHERE c.id = ?
    `, [id]);

    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Get students in this class
    const students = await db.all(`
      SELECT 
        s.*,
        p.name as parent_name,
        p.email as parent_email
      FROM students s
      JOIN student_classes sc ON s.id = sc.student_id
      JOIN users p ON s.parent_id = p.id
      WHERE sc.class_id = ?
      ORDER BY s.name
    `, [id]);

    res.json({
      ...classData,
      students: students || []
    });
  } catch (error) {
    console.error('Error fetching class:', error);
    res.status(500).json({ error: 'Failed to fetch class' });
  }
});

// Create new class
router.post('/', localAuthMiddleware, async (req, res) => {
  try {
    const { name, description, teacher_id, age_group, max_students, schedule } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Class name is required' });
    }

    // Check if teacher exists if provided
    if (teacher_id) {
      const teacher = await db.get('SELECT id FROM users WHERE id = ? AND role = "teacher"', [teacher_id]);
      if (!teacher) {
        return res.status(400).json({ error: 'Invalid teacher selected' });
      }
    }

    const result = await db.run(`
      INSERT INTO classes (name, description, teacher_id, age_group, max_students, schedule, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [name.trim(), description || '', teacher_id || null, age_group || '', max_students || 20, schedule || '']);

    const newClass = await db.get(`
      SELECT 
        c.*,
        u.name as teacher_name
      FROM classes c
      LEFT JOIN users u ON c.teacher_id = u.id
      WHERE c.id = ?
    `, [result.lastID]);

    res.status(201).json(newClass);
  } catch (error) {
    console.error('Error creating class:', error);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// Update class
router.put('/:id', localAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, teacher_id, age_group, max_students, schedule } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Class name is required' });
    }

    // Check if class exists
    const existingClass = await db.get('SELECT id FROM classes WHERE id = ?', [id]);
    if (!existingClass) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Check if teacher exists if provided
    if (teacher_id) {
      const teacher = await db.get('SELECT id FROM users WHERE id = ? AND role = "teacher"', [teacher_id]);
      if (!teacher) {
        return res.status(400).json({ error: 'Invalid teacher selected' });
      }
    }

    await db.run(`
      UPDATE classes 
      SET name = ?, description = ?, teacher_id = ?, age_group = ?, max_students = ?, schedule = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [name.trim(), description || '', teacher_id || null, age_group || '', max_students || 20, schedule || '', id]);

    const updatedClass = await db.get(`
      SELECT 
        c.*,
        u.name as teacher_name
      FROM classes c
      LEFT JOIN users u ON c.teacher_id = u.id
      WHERE c.id = ?
    `, [id]);

    res.json(updatedClass);
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({ error: 'Failed to update class' });
  }
});

// Delete class
router.delete('/:id', localAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if class exists
    const existingClass = await db.get('SELECT id FROM classes WHERE id = ?', [id]);
    if (!existingClass) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Check if class has students
    const studentCount = await db.get('SELECT COUNT(*) as count FROM student_classes WHERE class_id = ?', [id]);
    if (studentCount.count > 0) {
      return res.status(400).json({ error: 'Cannot delete class with enrolled students. Please move students to other classes first.' });
    }

    await db.run('DELETE FROM classes WHERE id = ?', [id]);

    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Error deleting class:', error);
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

// Assign student to class
router.post('/:id/students', localAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { student_id } = req.body;

    if (!student_id) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    // Check if class exists
    const classData = await db.get('SELECT id, max_students FROM classes WHERE id = ?', [id]);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Check if student exists
    const student = await db.get('SELECT id FROM students WHERE id = ?', [student_id]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check if student is already in this class
    const existing = await db.get('SELECT id FROM student_classes WHERE class_id = ? AND student_id = ?', [id, student_id]);
    if (existing) {
      return res.status(400).json({ error: 'Student is already in this class' });
    }

    // Check class capacity
    const currentCount = await db.get('SELECT COUNT(*) as count FROM student_classes WHERE class_id = ?', [id]);
    if (currentCount.count >= classData.max_students) {
      return res.status(400).json({ error: 'Class is at maximum capacity' });
    }

    await db.run('INSERT INTO student_classes (class_id, student_id, enrolled_at) VALUES (?, ?, datetime("now"))', [id, student_id]);

    res.json({ message: 'Student assigned to class successfully' });
  } catch (error) {
    console.error('Error assigning student to class:', error);
    res.status(500).json({ error: 'Failed to assign student to class' });
  }
});

// Remove student from class
router.delete('/:id/students/:student_id', localAuthMiddleware, async (req, res) => {
  try {
    const { id, student_id } = req.params;

    const result = await db.run('DELETE FROM student_classes WHERE class_id = ? AND student_id = ?', [id, student_id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Student not found in this class' });
    }

    res.json({ message: 'Student removed from class successfully' });
  } catch (error) {
    console.error('Error removing student from class:', error);
    res.status(500).json({ error: 'Failed to remove student from class' });
  }
});

// Get all teachers (for assignment dropdown)
router.get('/teachers/available', localAuthMiddleware, async (req, res) => {
  try {
    const teachers = await db.all(`
      SELECT id, name, email
      FROM users 
      WHERE role = 'teacher'
      ORDER BY name
    `);

    res.json(teachers || []);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// Get all students (for assignment dropdown)
router.get('/students/available', localAuthMiddleware, async (req, res) => {
  try {
    const students = await db.all(`
      SELECT 
        s.id, 
        s.name, 
        s.age,
        p.name as parent_name
      FROM students s
      JOIN users p ON s.parent_id = p.id
      ORDER BY s.name
    `);

    res.json(students || []);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

module.exports = router; 