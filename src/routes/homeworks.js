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
    type,
    items
  } = req.body;

  // Log the received payload for debugging
  console.log('📝 Homework upload request:', {
    title,
    dueDate,
    fileUrl,
    className,
    grade,
    uploadedBy,
    type,
    items,
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
      INSERT INTO homeworks (title, instructions, due_date, file_url, status, uploaded_by_teacher_id, class_name, grade, type, items, created_at)
      VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, NOW())
    `;
    const params = [title, instructions || null, formattedDueDate, fileUrl || null, uploadedBy, className, grade, type || null, items ? JSON.stringify(items) : null];

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

// FCM token registration endpoint
router.post('/fcm/token', authMiddleware, async (req, res) => {
  console.log('🔔 FCM token registration request:', {
    body: req.body,
    user: req.user,
    headers: req.headers.authorization ? 'Has auth header' : 'No auth header'
  });
  
  const { token, parentId } = req.body;
  // Use parentId from request body if provided, otherwise fall back to auth user
  const userId = parentId || req.user.id;
  
  console.log('📋 FCM token data:', {
    token: token ? `${token.substring(0, 20)}...` : 'No token',
    userId,
    parentId,
    authUserId: req.user.id
  });

  if (!token) {
    console.error('❌ FCM token is required');
    return res.status(400).json({ error: 'FCM token is required' });
  }

  try {
    console.log('💾 Creating/updating FCM token in database...');
    // Create table if not exists (for first-time setup)
    await execute(`CREATE TABLE IF NOT EXISTS fcm_tokens (
      user_id INT PRIMARY KEY,
      token VARCHAR(255) NOT NULL,
      device_type VARCHAR(50) DEFAULT 'web',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`, [], 'skydek_DB');

    // Insert or update the token for the user
    await execute(
      'INSERT INTO fcm_tokens (user_id, token, device_type, updated_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE token = ?, device_type = ?, updated_at = NOW()',
      [userId, token, 'web', token, 'web'],
      'skydek_DB'
    );
    
    console.log('✅ FCM token saved successfully for user:', userId);
    res.status(200).json({ message: 'FCM token registered successfully', userId });
  } catch (err) {
    console.error('🔥 Error saving FCM token:', {
      error: err.message,
      stack: err.stack,
      code: err.code,
      sqlState: err.sqlState
    });
    res.status(500).json({ 
      error: 'Failed to save FCM token',
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { details: err.stack })
    });
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


