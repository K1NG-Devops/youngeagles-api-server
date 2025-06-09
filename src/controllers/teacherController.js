import { query } from '../db.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

export const getChildrenByTeacher = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Step 1: Get teacher's class info
    const teacherRows = await query(
      "SELECT className FROM users WHERE id = ?",
      [teacherId],
      'railway' // specify which db
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ message: "Teacher not found." });
    }

    const className = teacherRows[0].className;

    // Step 2: Fetch all children in that class
    const children = await query(
      "SELECT * FROM children WHERE className = ?",
      [className],
      'skydek_DB'
    );

    res.status(200).json({ children });
  } catch (error) {
    logger.error('Error fetching children:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
