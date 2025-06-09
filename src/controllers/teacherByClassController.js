import { query } from '../db.js';

export async function getTeacherByClass(req, res) {
  const { className, grade } = req.query;
  if (!className || !grade) {
    return res.status(400).json({ message: 'Missing className or grade' });
  }
  try {
    const rows = await query(
      'SELECT * FROM users WHERE className = ? AND grade = ?',
      [className, grade],
      'railway'
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    const teacher = rows[0];
    res.json({ teacher });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving teacher', error: error.message });
  }
} 