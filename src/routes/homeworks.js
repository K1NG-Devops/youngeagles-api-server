import express from 'express';
import { query, execute } from '../db.js';
import { getHomeworkForParent, getHomeworksForTeacher } from '../controllers/homeworkController.js';
import { authMiddleware, isTeacher } from '../middleware/authMiddleware.js';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  // You'll need to add your Firebase service account key
  // For now, we'll use a mock function
  console.log('Firebase Admin not initialized - push notifications disabled');
}

// Function to send homework notification to parents
const sendHomeworkNotification = async (className, homeworkTitle, teacherName, homeworkId) => {
  try {
    console.log('📢 Sending homework notification:', {
      className,
      homeworkTitle,
      teacherName,
      homeworkId
    });
    
    // Get all parents with children in this class
    const parents = await query(
      `SELECT DISTINCT c.parent_id, u.name as parent_name 
       FROM children c 
       LEFT JOIN users u ON c.parent_id = u.id 
       WHERE c.className = ?`,
      [className],
      'skydek_DB'
    );
    
    console.log(`Found ${parents.length} parents in class ${className}`);
    
    // Get FCM tokens for these parents
    const parentIds = parents.map(p => p.parent_id);
    if (parentIds.length === 0) return;
    
    const tokens = await query(
      `SELECT user_id, token FROM fcm_tokens 
       WHERE user_id IN (${parentIds.map(() => '?').join(',')}) AND is_active = TRUE`,
      parentIds,
      'skydek_DB'
    );
    
    console.log(`Found ${tokens.length} active FCM tokens`);
    
    if (tokens.length === 0) {
      console.log('No active FCM tokens found for parents in this class');
      return;
    }
    
    // Prepare notification payload
    const notification = {
      title: 'New Homework Posted! 📚',
      body: `Teacher ${teacherName} posted "${homeworkTitle}" for your child's class.`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-96x96.png',
      tag: `homework-${homeworkId}`,
      data: {
        type: 'homework',
        homeworkId: homeworkId.toString(),
        teacherName,
        className,
        url: '/homework'
      }
    };
    
    // For now, just log the notification since Firebase Admin might not be set up
    console.log('📱 Would send notification to tokens:', {
      tokenCount: tokens.length,
      notification,
      targetTokens: tokens.map(t => `${t.token.substring(0, 20)}...`)
    });
    
    // TODO: Uncomment when Firebase Admin is properly configured
    /*
    const tokenList = tokens.map(t => t.token);
    
    const message = {
      notification,
      data: notification.data,
      tokens: tokenList
    };
    
    const response = await admin.messaging().sendMulticast(message);
    console.log('Push notification sent:', {
      successCount: response.successCount,
      failureCount: response.failureCount
    });
    
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokenList[idx]);
        }
      });
      console.log('Failed tokens:', failedTokens);
    }
    */
    
    // Store notification in database for parents to see
    for (const parent of parents) {
      await execute(
        `INSERT INTO notifications (user_id, user_type, title, message, type, related_id, related_type, created_at) 
         VALUES (?, 'parent', ?, ?, 'homework', ?, 'homework', NOW())`,
        [
          parent.parent_id,
          notification.title,
          notification.body,
          homeworkId
        ],
        'skydek_DB'
      );
    }
    
    console.log('✅ Homework notification process completed');
    
  } catch (error) {
    console.error('❌ Error sending homework notification:', error);
    // Don't throw error to prevent homework upload from failing
  }
};

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
    
    // Get teacher's name for notification
    const [teacher] = await query(
      'SELECT name FROM users WHERE id = ?',
      [uploadedBy],
      'railway'
    );
    const teacherName = teacher?.name || 'Your teacher';
    
    // Send push notification to parents in this class
    await sendHomeworkNotification(className, title, teacherName, result.insertId);
    
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

// Route for fetching homeworks for a specific parent
router.get('/for-parent/:parent_id', authMiddleware, getHomeworkForParent);

// Route for fetching homeworks posted by a specific teacher
router.get('/for-teacher/:teacherId', authMiddleware, getHomeworksForTeacher);

// Route for listing homeworks by class
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

export default router;

