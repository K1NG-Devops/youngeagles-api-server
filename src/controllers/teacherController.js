import { query } from '../db.js';
import winston from 'winston';

// Logger
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
    const [teacherRows] = await query(
      "SELECT className FROM users WHERE id = ?",
      [teacherId],
      'railway' // ✅ Optional: specify DB if needed
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ message: "Teacher not found." });
    }

    const className = teacherRows[0].className;

    // Step 2: Get children in that class
    const [childrenRows] = await query(
      "SELECT * FROM children WHERE className = ?",
      [className],
      'skydek_DB' // ✅ Optional: switch DB if children are in a different DB
    );

    res.status(200).json({ children: childrenRows });
  } catch (error) {
    logger.error('Error fetching children:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
