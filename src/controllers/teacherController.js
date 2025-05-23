import { query } from '../db.js';
import winston from 'winston';

// Logger (optional, reuse if needed)
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

// Get Children for Logged-in Teacher
export const getChildrenByTeacher = async (req, res) => {
  try {
    const teacherId = req.user.id; // assumes JWT middleware sets req.user
    const [teacher] = await query('SELECT grade, className FROM users WHERE id = ? AND role = ?', [teacherId, 'teacher']);

    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found or not authorized.' });
    }

    const { grade, className } = teacher;

    const children = await query(
      'SELECT * FROM children WHERE grade = ? AND className = ?',
      [grade, className]
    );

    res.status(200).json({ children });
  } catch (err) {
    logger.error('Error fetching children:', err);
    res.status(500).json({ message: 'Server error fetching children.' });
  }
};
