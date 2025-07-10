import express from 'express';
import { verifyTokenMiddleware } from '../utils/security.js';
import { query } from '../db.js';
import pushNotificationService from '../services/pushNotificationService.js';

const router = express.Router();

// Get VAPID public key for frontend subscription
router.get('/vapid-public-key', async (req, res) => {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    
    if (!publicKey) {
      return res.status(500).json({
        success: false,
        error: 'VAPID public key not configured'
      });
    }

    res.json({
      success: true,
      publicKey: publicKey
    });
  } catch (error) {
    console.error('Error getting VAPID public key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get VAPID public key'
    });
  }
});

// Subscribe to push notifications
router.post('/subscribe', verifyTokenMiddleware, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    const userId = req.user.id;
    const userType = req.user.userType;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription data'
      });
    }

    // Check if subscription already exists
    const existingSubscription = await query(`
      SELECT id FROM push_subscriptions 
      WHERE userId = ? AND endpoint = ?
    `, [userId, endpoint]);

    if (existingSubscription.length > 0) {
      return res.json({
        success: true,
        message: 'Push subscription already exists',
        subscriptionId: existingSubscription[0].id
      });
    }

    // Store subscription in database
    const result = await query(`
      INSERT INTO push_subscriptions (
        userId, userType, endpoint, p256dh, auth, 
        isActive, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())
    `, [userId, userType, endpoint, keys.p256dh, keys.auth]);

    console.log(`✅ Push subscription registered for user ${userId} (${userType})`);

    res.json({
      success: true,
      message: 'Push subscription registered successfully',
      subscriptionId: result.insertId
    });

  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe to push notifications'
    });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', verifyTokenMiddleware, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const userId = req.user.id;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Endpoint is required'
      });
    }

    // Deactivate subscription
    const result = await query(`
      UPDATE push_subscriptions 
      SET isActive = 0, updatedAt = NOW()
      WHERE userId = ? AND endpoint = ?
    `, [userId, endpoint]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    console.log(`✅ Push subscription removed for user ${userId}`);

    res.json({
      success: true,
      message: 'Push subscription removed successfully'
    });

  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unsubscribe from push notifications'
    });
  }
});

// Send push notification (admin/teacher only)
router.post('/send', verifyTokenMiddleware, async (req, res) => {
  try {
    const { title, body, recipients, data } = req.body;
    const senderId = req.user.id;
    const senderType = req.user.userType;

    // Verify user has permission to send notifications
    if (!['admin', 'teacher'].includes(senderType)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - admin or teacher required'
      });
    }

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: 'Title and body are required'
      });
    }

    // Send push notifications
    const results = await pushNotificationService.sendToUsers(
      recipients,
      {
        title,
        body,
        data: data || {}
      }
    );

    // Log notification sending
    console.log(`📱 Push notification sent by ${senderType} ${senderId} to ${recipients.length} users`);

    res.json({
      success: true,
      message: 'Push notifications sent successfully',
      results: {
        sent: results.sent,
        failed: results.failed,
        totalRecipients: recipients.length
      }
    });

  } catch (error) {
    console.error('Error sending push notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send push notifications'
    });
  }
});

// Get user's push subscriptions
router.get('/subscriptions', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const subscriptions = await query(`
      SELECT id, endpoint, isActive, createdAt, updatedAt
      FROM push_subscriptions 
      WHERE userId = ? 
      ORDER BY createdAt DESC
    `, [userId]);

    res.json({
      success: true,
      subscriptions: subscriptions
    });

  } catch (error) {
    console.error('Error fetching push subscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch push subscriptions'
    });
  }
});

// Test push notification (development only)
router.post('/test', verifyTokenMiddleware, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Test endpoint not available in production'
      });
    }

    const userId = req.user.id;
    const { title = 'Test Notification', body = 'This is a test push notification' } = req.body;

    // Send test notification to the requesting user
    const results = await pushNotificationService.sendToUsers(
      [userId],
      {
        title,
        body,
        data: { type: 'test' }
      }
    );

    res.json({
      success: true,
      message: 'Test notification sent',
      results: results
    });

  } catch (error) {
    console.error('Error sending test push notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification'
    });
  }
});

export default router; 