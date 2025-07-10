import webPush from 'web-push';
import { query } from '../db.js';

class PushNotificationService {
  constructor() {
    this.isConfigured = false;
    this.init();
  }

  async init() {
    try {
      // Check if web push is enabled
      const webPushEnabled = process.env.WEB_PUSH_ENABLED === 'true';
      
      if (!webPushEnabled) {
        console.log('📱 Web push notifications disabled');
        return;
      }

      const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
      const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@youngeagles.org.za';

      if (!vapidPublicKey || !vapidPrivateKey) {
        console.warn('⚠️ VAPID keys not configured - push notifications will not work');
        return;
      }

      // Validate VAPID keys are not placeholder values
      if (vapidPublicKey.includes('your-vapid') || vapidPrivateKey.includes('your-vapid')) {
        console.warn('⚠️ VAPID keys are placeholder values - push notifications will not work');
        return;
      }

      // Set VAPID details for web-push
      webPush.setVapidDetails(
        vapidEmail,
        vapidPublicKey,
        vapidPrivateKey
      );

      this.isConfigured = true;
      console.log('✅ Push notification service initialized with VAPID keys');
    } catch (error) {
      console.error('❌ Failed to initialize push notification service:', error);
    }
  }

  /**
   * Send push notification to specific users
   */
  async sendToUsers(userIds, notification) {
    if (!this.isConfigured) {
      console.warn('⚠️ Push notification service not configured');
      return { sent: 0, failed: userIds.length };
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('User IDs must be a non-empty array');
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    try {
      // Get active push subscriptions for these users
      const subscriptions = await query(`
        SELECT id, userId, endpoint, p256dh, auth, userType
        FROM push_subscriptions 
        WHERE userId IN (${userIds.map(() => '?').join(',')}) 
        AND isActive = 1
      `, userIds);

      if (subscriptions.length === 0) {
        console.log(`📱 No active push subscriptions found for ${userIds.length} users`);
        return results;
      }

      // Send to each subscription
      const pushPromises = subscriptions.map(async (subscription) => {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth
            }
          };

          const payload = JSON.stringify({
            title: notification.title,
            body: notification.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            data: notification.data || {},
            tag: 'young-eagles-notification',
            requireInteraction: notification.requireInteraction || false,
            actions: notification.actions || []
          });

          await webPush.sendNotification(pushSubscription, payload);
          
          console.log(`📱 Push notification sent to user ${subscription.userId} (${subscription.userType})`);
          results.sent++;
          
        } catch (error) {
          console.error(`❌ Failed to send push notification to user ${subscription.userId}:`, error);
          results.failed++;
          results.errors.push({
            userId: subscription.userId,
            error: error.message
          });

          // If subscription is invalid, deactivate it
          if (error.statusCode === 410 || error.statusCode === 404) {
            await this.deactivateSubscription(subscription.id);
          }
        }
      });

      await Promise.all(pushPromises);

      console.log(`📱 Push notification batch complete: ${results.sent} sent, ${results.failed} failed`);
      return results;

    } catch (error) {
      console.error('❌ Error sending push notifications:', error);
      throw error;
    }
  }

  /**
   * Send push notification to all parents
   */
  async sendToAllParents(notification) {
    try {
      // Get all parent user IDs
      const parents = await query(`
        SELECT id FROM users WHERE role = 'parent'
        UNION
        SELECT id FROM parents WHERE 1=1
      `);

      const parentIds = parents.map(parent => parent.id);
      
      if (parentIds.length === 0) {
        console.log('📱 No parents found for push notification');
        return { sent: 0, failed: 0 };
      }

      return await this.sendToUsers(parentIds, notification);
    } catch (error) {
      console.error('❌ Error sending push notification to all parents:', error);
      throw error;
    }
  }

  /**
   * Send push notification to parents of specific children
   */
  async sendToParentsOfChildren(childrenIds, notification) {
    if (!Array.isArray(childrenIds) || childrenIds.length === 0) {
      throw new Error('Children IDs must be a non-empty array');
    }

    try {
      // Get parent IDs for these children
      const parents = await query(`
        SELECT DISTINCT parent_id FROM children 
        WHERE id IN (${childrenIds.map(() => '?').join(',')})
        AND parent_id IS NOT NULL
      `, childrenIds);

      const parentIds = parents.map(parent => parent.parent_id);
      
      if (parentIds.length === 0) {
        console.log('📱 No parents found for specified children');
        return { sent: 0, failed: 0 };
      }

      return await this.sendToUsers(parentIds, notification);
    } catch (error) {
      console.error('❌ Error sending push notification to parents of children:', error);
      throw error;
    }
  }

  /**
   * Send push notification to parents in specific classes
   */
  async sendToParentsInClasses(classIds, notification) {
    if (!Array.isArray(classIds) || classIds.length === 0) {
      throw new Error('Class IDs must be a non-empty array');
    }

    try {
      // Get parent IDs for children in these classes
      const parents = await query(`
        SELECT DISTINCT c.parent_id 
        FROM children c
        WHERE c.class_id IN (${classIds.map(() => '?').join(',')})
        AND c.parent_id IS NOT NULL
      `, classIds);

      const parentIds = parents.map(parent => parent.parent_id);
      
      if (parentIds.length === 0) {
        console.log('📱 No parents found for specified classes');
        return { sent: 0, failed: 0 };
      }

      return await this.sendToUsers(parentIds, notification);
    } catch (error) {
      console.error('❌ Error sending push notification to parents in classes:', error);
      throw error;
    }
  }

  /**
   * Send homework notification to parents
   */
  async sendHomeworkNotification(homeworkId, teacherName) {
    try {
      // Get homework details and affected parents
      const homework = await query(`
        SELECT h.title, h.description, h.class_id, h.due_date, h.assignment_type
        FROM homework h
        WHERE h.id = ?
      `, [homeworkId]);

      if (homework.length === 0) {
        throw new Error('Homework not found');
      }

      const hw = homework[0];
      const classId = hw.class_id;

      // Get children in this class
      const children = await query(`
        SELECT c.id, c.first_name, c.last_name, c.parent_id
        FROM children c
        WHERE c.class_id = ? AND c.parent_id IS NOT NULL
      `, [classId]);

      if (children.length === 0) {
        console.log('📱 No children found in class for homework notification');
        return { sent: 0, failed: 0 };
      }

      const parentIds = [...new Set(children.map(child => child.parent_id))];
      
      const notification = {
        title: '📚 New Homework Assignment',
        body: `${teacherName} has assigned "${hw.title}" to your child's class. ${hw.assignment_type === 'individual' ? 'Individual assignment' : 'Class assignment'} due ${new Date(hw.due_date).toLocaleDateString()}.`,
        data: {
          type: 'homework',
          homeworkId: homeworkId,
          classId: classId,
          teacherName: teacherName,
          url: `/homework/${homeworkId}`
        },
        requireInteraction: true
      };

      return await this.sendToUsers(parentIds, notification);
    } catch (error) {
      console.error('❌ Error sending homework notification:', error);
      throw error;
    }
  }

  /**
   * Send announcement notification to parents
   */
  async sendAnnouncementNotification(title, message, targetAudience = 'all') {
    try {
      let parentIds = [];

      if (targetAudience === 'all') {
        // Get all parent IDs
        const parents = await query(`
          SELECT DISTINCT id FROM users WHERE role = 'parent'
          UNION
          SELECT DISTINCT parent_id FROM children WHERE parent_id IS NOT NULL
        `);
        parentIds = parents.map(parent => parent.id || parent.parent_id);
      } else if (Array.isArray(targetAudience)) {
        // Specific parent IDs provided
        parentIds = targetAudience;
      }

      if (parentIds.length === 0) {
        console.log('📱 No parents found for announcement notification');
        return { sent: 0, failed: 0 };
      }

      const notification = {
        title: '📢 ' + title,
        body: message,
        data: {
          type: 'announcement',
          url: '/notifications'
        },
        requireInteraction: true
      };

      return await this.sendToUsers(parentIds, notification);
    } catch (error) {
      console.error('❌ Error sending announcement notification:', error);
      throw error;
    }
  }

  /**
   * Send grading notification to parent
   */
  async sendGradingNotification(submissionId, parentId, grade, feedback, teacherName) {
    try {
      const notification = {
        title: '📊 Homework Graded',
        body: `${teacherName} has graded your child's homework. Score: ${grade}%. ${feedback ? 'Feedback: ' + feedback.substring(0, 100) + (feedback.length > 100 ? '...' : '') : ''}`,
        data: {
          type: 'grading',
          submissionId: submissionId,
          grade: grade,
          url: `/homework/submissions/${submissionId}`
        },
        requireInteraction: true
      };

      return await this.sendToUsers([parentId], notification);
    } catch (error) {
      console.error('❌ Error sending grading notification:', error);
      throw error;
    }
  }

  /**
   * Deactivate invalid push subscription
   */
  async deactivateSubscription(subscriptionId) {
    try {
      await query(`
        UPDATE push_subscriptions 
        SET isActive = 0, updatedAt = NOW()
        WHERE id = ?
      `, [subscriptionId]);
      
      console.log(`🗑️ Deactivated invalid push subscription ${subscriptionId}`);
    } catch (error) {
      console.error('❌ Error deactivating push subscription:', error);
    }
  }

  /**
   * Get subscription stats
   */
  async getSubscriptionStats() {
    try {
      const stats = await query(`
        SELECT 
          userType,
          COUNT(*) as total,
          SUM(isActive) as active,
          COUNT(*) - SUM(isActive) as inactive
        FROM push_subscriptions 
        GROUP BY userType
      `);

      return stats;
    } catch (error) {
      console.error('❌ Error getting subscription stats:', error);
      return [];
    }
  }
}

export default new PushNotificationService(); 