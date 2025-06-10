import express from 'express';
import { query, execute } from '../db.js';
import { getHomeworkForParent } from '../controllers/homeworkController.js';
import { authMiddleware, isTeacher } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/upload', authMiddleware, isTeacher, async (req, res) => {
  const {
    title,
    instructions,
    dueDate,
    fileUrl,
    className,
    grade,
    uploadedBy,
  } = req.body;

  // Log the received payload for debugging
  console.log('📝 Homework upload request:', {
    title,
    dueDate,
    fileUrl,
    className,
    grade,
    uploadedBy,
    hasTitle: !!title,
    hasDueDate: !!dueDate,
    hasClassName: !!className,
    hasGrade: !!grade,
    hasUploadedBy: !!uploadedBy
  });

  // ✅ Make fileUrl optional - only require core fields
  if (!title || !dueDate || !className || !grade || !uploadedBy) {
    const missingFields = [];
    if (!title) missingFields.push('title');
    if (!dueDate) missingFields.push('dueDate');
    if (!className) missingFields.push('className');
    if (!grade) missingFields.push('grade');
    if (!uploadedBy) missingFields.push('uploadedBy');
    
    console.error('❌ Missing required fields:', missingFields);
    return res.status(400).json({ 
      error: "Missing required fields", 
      missingFields,
      received: { title, dueDate, className, grade, uploadedBy }
    });
  }

  // ✅ Now that dueDate is confirmed to exist, format it
  const formattedDueDate = new Date(dueDate).toISOString().split('T')[0];

  try {
    const sql = `
      INSERT INTO homeworks (title, instructions, due_date, file_url, status, uploaded_by_teacher_id, class_name, grade, created_at)
      VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?, NOW())
    `;
    const params = [title, instructions || null, formattedDueDate, fileUrl || null, uploadedBy, className, grade];

    const result = await execute(sql, params, 'skydek_DB');
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



router.get('/for-parent/:parent_id', authMiddleware, getHomeworkForParent);


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
    const [homeworks] = await query(sql, [className], 'skydek_DB');

    res.json({ homeworks });
  } catch (err) {
    console.error("Error fetching homeworks:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


