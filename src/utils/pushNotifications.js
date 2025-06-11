import { initializeFirebaseAdmin } from '../config/firebase-admin.js';

// Initialize Firebase Admin
const admin = initializeFirebaseAdmin();

export const sendPushNotification = async (tokens, notification, data = {}) => {
  if (!admin) {
    console.log('📱 Push notifications are disabled - Firebase Admin not initialized');
    return { success: false, reason: 'Firebase Admin not initialized' };
  }

  if (!tokens || tokens.length === 0) {
    console.log('📱 No FCM tokens provided for push notification');
    return { success: false, reason: 'No tokens provided' };
  }

  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/pwa-192x192.png',
        badge: notification.badge || '/pwa-96x96.png',
      },
      data: {
        ...data,
        click_action: data.url || '/homework',
        tag: notification.tag || 'default',
      },
      tokens: Array.isArray(tokens) ? tokens : [tokens],
    };

    console.log('📤 Sending push notification:', {
      tokenCount: message.tokens.length,
      title: notification.title,
      body: notification.body
    });

    const response = await admin.messaging().sendMulticast(message);
    
    console.log('📨 Push notification sent:', {
      successCount: response.successCount,
      failureCount: response.failureCount
    });

    // Handle failed tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push({
            token: message.tokens[idx],
            error: resp.error?.message || 'Unknown error'
          });
        }
      });
      console.log('❌ Failed tokens:', failedTokens);
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      failedTokens: response.responses
        .map((resp, idx) => resp.success ? null : message.tokens[idx])
        .filter(Boolean)
    };
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const validateToken = async (token) => {
  if (!admin) {
    return false;
  }

  try {
    await admin.messaging().send({
      token,
      data: { test: 'true' }
    }, true); // dry run
    return true;
  } catch (error) {
    console.log('🔍 Invalid FCM token:', error.message);
    return false;
  }
};

