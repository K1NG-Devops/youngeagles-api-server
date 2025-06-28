import webPush from 'web-push';
import { query } from '../db.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.log('🚨 You must set the VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables. Skipping web-push setup.');
} else {
  webPush.setVapidDetails(
    'mailto:support@youngeagles.org.za',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log('✅ Web Push VAPID details set.');
}

export const sendWebPushNotification = async (userId, payload) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('❌ Cannot send web push notification: VAPID keys are not configured.');
    return;
  }

  try {
    // Get all subscriptions for the user
    const subscriptions = await query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
      [userId]
    );

    if (subscriptions.length === 0) {
      console.log(`🤷 No push subscriptions found for user ${userId}.`);
      return;
    }

    console.log(`📤 Sending web push notification to ${subscriptions.length} subscription(s) for user ${userId}.`);

    const notificationPayload = JSON.stringify(payload);

    // Send a notification to each subscription
    const sendPromises = subscriptions.map(sub => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      return webPush.sendNotification(pushSubscription, notificationPayload)
        .catch(error => {
          console.error(`❌ Error sending notification to ${sub.endpoint.substring(0, 30)}...:`, error.statusCode);
          // If a subscription is no longer valid (e.g., 404 or 410), we should remove it
          if (error.statusCode === 404 || error.statusCode === 410) {
            console.log(`🗑️ Deleting invalid subscription for user ${userId}.`);
            return query('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
          }
        });
    });

    await Promise.all(sendPromises);
    console.log(`✅ Web push notifications sent successfully to user ${userId}.`);

  } catch (dbError) {
    console.error('❌ Database error while sending push notifications:', dbError);
  }
}; 