import express from 'express';
import { query, execute } from '../db.js';
import { authMiddleware, isTeacher } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/upload', authMiddleware, isTeacher, async (req, res) => {
  const {
    title,
    dueDate,
    fileUrl,
    className,
    grade,
    uploadedBy,
  } = req.body;

  if (!title || !dueDate || !fileUrl || !className || !grade || !uploadedBy) {
    return res.status(400).json({ error: "All required fields must be provided." });
  }

  try {
    const sql = `
      INSERT INTO homeworks (title, due_date, file_url, status, uploaded_by_teacher_id, class_name, grade, created_at)
      VALUES (?, ?, ?, 'Pending', ?, ?, ?, NOW())
    `;
    const params = [title, dueDate, fileUrl, uploadedBy, className, grade];

    const result = await execute(sql, params, 'railway');
    res.status(201).json({
      message: "Homework uploaded successfully",
      insertedId: result.insertId,
    });
  } catch (err) {
    console.error("Error uploading homework:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;



router.get('/for-parent/:parent_id', authMiddleware, async (req, res) => {
  const { parent_id } = req.params;
  console.log('✅ Hitting /for-parent with ID:', parent_id);

  try {
    const [children] = await query(
      'SELECT className FROM children WHERE parent_id = ?',
      [parent_id],
      'skydek_DB'
    );
    console.log('Parent ID param:', parent_id, typeof parent_id);
    console.log('🎯 Fetched Children:', children);

    if (!children.length) {
      console.warn('❌ No children found for parent');
      return res.json({ homeworks: [] }); // TEMP: prevent 404 to test frontend
    }

    const classNames = children.map(c => c.className);
    console.log('🔍 Class Names:', classNames);

    const placeholders = classNames.map(() => '?').join(', ');
    const sql = `SELECT * FROM homeworks WHERE class_name IN (${placeholders}) ORDER BY due_date DESC`;

    const [homeworks] = await query(sql, classNames, 'railway');

    console.log('📚 Homeworks:', homeworks);
    res.json({ homeworks });
  } catch (err) {
    console.error('🔥 Error fetching homework:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


router.get('/list', authMiddleware, async (req, res) => {
  const { className } = req.query;

  // Only allow "Panda" and "Curious Cubs" classes
  const allowedClasses = ['Panda', 'Curious Cubs'];
  if (!className || !allowedClasses.includes(className)) {
    return res.status(400).json({ error: "className must be either 'Panda' or 'Curious Cubs'." });
  }

  try {
    const sql = `
      SELECT * FROM homeworks
      WHERE class_name = ?
      ORDER BY due_date DESC
    `;
    const [homeworks] = await query(sql, [className], 'railway');

    res.json({ homeworks });
  } catch (err) {
    console.error("Error fetching homeworks:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


