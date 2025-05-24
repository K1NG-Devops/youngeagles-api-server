import db from '../db/connection.js';

export const markAttendance = async (req, res) => {
  const { teacherId, childId, date, status, late } = req.body;

  if (!teacherId || !childId || !date || !status) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO attendance (teacher_id, child_id, date, status, late)
       VALUES (?, ?, ?, ?, ?)`,
      [teacherId, childId, date, status, late || false]
    );

    res.status(201).json({ message: 'Attendance marked', attendanceId: result.insertId });
  } catch (error) {
    console.error('Error saving attendance:', error);
    res.status(500).json({ message: 'Database error' });
  }
};
