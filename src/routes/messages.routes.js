import express from 'express';
import { verifyTokenMiddleware } from '../utils/security.js';
import { query } from '../db.js';

const router = express.Router();

// Forward /api/messages/notifications to notifications logic
router.get('/notifications', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const unreadOnly = req.query.unread_only === 'true';
    const offset = (page - 1) * limit;
    
    // Build WHERE clause based on filters
    let whereClause = 'WHERE userId = ?';
    const queryParams = [userId];
    
    if (unreadOnly) {
      whereClause += ' AND isRead = 0';
    }
    
    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM notifications ${whereClause}`;
    const [countResult] = await query(countQuery, queryParams);
    const total = countResult.total;
    
    // Get notifications for the user
    const notifications = await query(`
      SELECT 
        id,
        title,
        body as message,
        type,
        priority,
        isRead as \`read\`,
        'System' as sender,
        data,
        createdAt as timestamp
      FROM notifications 
      ${whereClause}
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);

    res.json({
      success: true,
      notifications: notifications,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

export default router;
