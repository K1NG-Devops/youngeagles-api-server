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

// // Get Children for Logged-in Teacher
// export const getChildrenByTeacher = async (req, res) => {
//   try {
//     const teacherId = req.user.id; // assumes JWT middleware sets req.user
//     const [rows] = await query('SELECT grade, className FROM users WHERE id = ? AND role = ?', [teacherId, 'teacher']);

//     if (rows.length === 0) {
//       return res.status(404).json({ message: 'Teacher not found or not authorized.' });
//     }

//     const { grade, className } = rows[0];

//     const children = await query(
//       'SELECT * FROM children WHERE grade = ? AND className = ?',
//       [grade, className]
//     );

//     res.status(200).json({ children });
//   } catch (err) {
//     logger.error('Error fetching children:', err);
//     res.status(500).json({ message: 'Server error fetching children.' });
//   }
// };

export const getChildrenByTeacher = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Step 1: Get teacher's class
    const teacherResult = await db.query(
      "SELECT className FROM users WHERE id = $1",
      [teacherId], ('railway')
    );

    if (teacherResult.rows.length === 0) {
      return res.status(404).json({ message: "Teacher not found." });
    }

    const className = teacherResult.rows[0].classname;

    // Step 2: Fetch all children in that class
    const childrenResult = await db.query(
      "SELECT * FROM children WHERE className = $1",
      [className], ('skydek_DB')
    );

    res.status(200).json({ children: childrenResult.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};