import express from 'express';
import { query, execute } from '../db.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;

if (!VAPID_PUBLIC_KEY) {
  console.error('🚨 VAPID_PUBLIC_KEY is not set in environment variables. Web Push will not work.');
}

// Send public VAPID key to client
router.get('/vapid-public-key', (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(500).json({ error: 'VAPID public key not configured on the server.' });
  }
  res.send(VAPID_PUBLIC_KEY);
});

// Subscribe to push notifications
router.post('/subscribe', authMiddleware, async (req, res) => {
  const subscription = req.body;
  const userId = req.user.id;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription object.' });
  }

  try {
    // Check if subscription already exists to avoid duplicates
    const existing = await query(
      'SELECT id FROM push_subscriptions WHERE endpoint = ?', 
      [subscription.endpoint]
    );

    if (existing.length > 0) {
      console.log('🔄 Subscription already exists for endpoint.');
      return res.status(200).json({ message: 'Subscription already exists.' });
    }

    // Save the new subscription
    await execute(
      'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)',
      [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
    );

    console.log(`✅ New subscription saved for user ${userId}`);
    res.status(201).json({ message: 'Subscription saved.' });
  } catch (error) {
    console.error('❌ Error saving push subscription:', error);
    res.status(500).json({ error: 'Failed to save subscription.' });
  }
});

// Unsubscribe from push notifications
router.delete('/unsubscribe', authMiddleware, async (req, res) => {
  const { endpoint } = req.body;
  const userId = req.user.id;

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is required to unsubscribe.' });
  }

  try {
    const result = await execute(
      'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
      [userId, endpoint]
    );

    if (result.affectedRows === 0) {
      console.log(`⚠️ No subscription found for user ${userId} with endpoint: ${endpoint}`);
      return res.status(404).json({ message: 'Subscription not found.' });
    }

    console.log(`✅ Subscription removed for user ${userId}`);
    res.status(200).json({ message: 'Successfully unsubscribed.' });
  } catch (error) {
    console.error('❌ Error removing push subscription:', error);
    res.status(500).json({ error: 'Failed to unsubscribe.' });
  }
});

export default router;
