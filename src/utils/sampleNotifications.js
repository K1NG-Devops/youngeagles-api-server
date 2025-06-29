import { db } from '../db.js';

/**
 * Create sample notifications for testing
 * This function will add various types of notifications to the database
 */
export async function createSampleNotifications() {
  if (!db) {
    console.log('⚠️ Database not available - cannot create sample notifications');
    return false;
  }

  try {
    console.log('🔔 Creating sample notifications...');

    // Sample notifications for admin user (ID: 1)
    const adminNotifications = [
      {
        user_id: 1,
        user_type: 'admin',
        type: 'announcement',
        title: 'System Maintenance Scheduled',
        message: 'System maintenance is scheduled for tonight at 11 PM. Expected downtime: 30 minutes.',
        priority: 'high',
        related_type: 'system'
      },
      {
        user_id: 1,
        user_type: 'admin',
        type: 'new_message',
        title: 'New Parent Registration',
        message: 'A new parent has registered: Sarah Johnson. Please review and approve.',
        priority: 'medium',
        related_id: 5,
        related_type: 'user_registration'
      },
      {
        user_id: 1,
        user_type: 'admin',
        type: 'homework',
        title: 'Homework Submission Alert',
        message: '15 new homework submissions require teacher review.',
        priority: 'medium',
        related_type: 'homework_submissions'
      },
      {
        user_id: 1,
        user_type: 'admin',
        type: 'announcement',
        title: 'Database Backup Complete',
        message: 'Daily database backup completed successfully at 3:00 AM.',
        priority: 'low',
        related_type: 'system'
      }
    ];

    // Sample notifications for teacher user (ID: 1 in staff table)
    const teacherNotifications = [
      {
        user_id: 1,
        user_type: 'teacher',
        type: 'new_message',
        title: 'Message from Parent',
        message: 'Parent John Smith sent you a message about his child\'s homework.',
        priority: 'medium',
        related_id: 10,
        related_type: 'conversation'
      },
      {
        user_id: 1,
        user_type: 'teacher',
        type: 'homework',
        title: 'Assignment Due Tomorrow',
        message: 'Reminder: Math Assignment #5 is due tomorrow. 3 students haven\'t submitted yet.',
        priority: 'medium',
        related_id: 25,
        related_type: 'homework'
      },
      {
        user_id: 1,
        user_type: 'teacher',
        type: 'announcement',
        title: 'Parent-Teacher Conference Week',
        message: 'Next week is parent-teacher conference week. Please check your schedule.',
        priority: 'high',
        related_type: 'event'
      }
    ];

    // Sample notifications for parent user (ID: 1 in users table)
    const parentNotifications = [
      {
        user_id: 1,
        user_type: 'parent',
        type: 'homework',
        title: 'New Homework Assignment',
        message: 'Your child has a new Math homework assignment due Friday.',
        priority: 'medium',
        related_id: 15,
        related_type: 'homework'
      },
      {
        user_id: 1,
        user_type: 'parent',
        type: 'announcement',
        title: 'School Holiday Notice',
        message: 'School will be closed on Monday for Heritage Day. Regular classes resume Tuesday.',
        priority: 'medium',
        related_type: 'announcement'
      },
      {
        user_id: 1,
        user_type: 'parent',
        type: 'new_message',
        title: 'Message from Teacher',
        message: 'Ms. Anderson sent you a message about your child\'s progress.',
        priority: 'high',
        related_id: 8,
        related_type: 'conversation'
      }
    ];

    // Insert all notifications
    const allNotifications = [
      ...adminNotifications,
      ...teacherNotifications,
      ...parentNotifications
    ];

    const insertQuery = `
      INSERT INTO notifications (
        user_id, user_type, type, title, message, 
        priority, related_id, related_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    let insertedCount = 0;
    for (const notification of allNotifications) {
      try {
        await db.execute(insertQuery, [
          notification.user_id,
          notification.user_type,
          notification.type,
          notification.title,
          notification.message,
          notification.priority,
          notification.related_id || null,
          notification.related_type || null
        ]);
        insertedCount++;
      } catch (error) {
        console.error('❌ Error inserting notification:', error.message);
      }
    }

    console.log(`✅ Successfully created ${insertedCount} sample notifications`);
    console.log('📊 Breakdown:');
    console.log(`   - Admin notifications: ${adminNotifications.length}`);
    console.log(`   - Teacher notifications: ${teacherNotifications.length}`);
    console.log(`   - Parent notifications: ${parentNotifications.length}`);

    return true;

  } catch (error) {
    console.error('❌ Error creating sample notifications:', error);
    return false;
  }
}

/**
 * Clear all notifications (for testing purposes)
 */
export async function clearAllNotifications() {
  if (!db) {
    console.log('⚠️ Database not available - cannot clear notifications');
    return false;
  }

  try {
    const [result] = await db.execute('DELETE FROM notifications');
    console.log(`✅ Cleared ${result.affectedRows} notifications`);
    return true;
  } catch (error) {
    console.error('❌ Error clearing notifications:', error);
    return false;
  }
}

/**
 * Create a notification for a specific user
 */
export async function createNotification(userId, userType, type, title, message, priority = 'medium', relatedId = null, relatedType = null) {
  if (!db) {
    console.log('⚠️ Database not available - cannot create notification');
    return false;
  }

  try {
    const insertQuery = `
      INSERT INTO notifications (
        user_id, user_type, type, title, message, 
        priority, related_id, related_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await db.execute(insertQuery, [
      userId, userType, type, title, message,
      priority, relatedId, relatedType
    ]);

    console.log(`✅ Created notification ${result.insertId} for ${userType} ${userId}`);
    return result.insertId;

  } catch (error) {
    console.error('❌ Error creating notification:', error);
    return false;
  }
}

/**
 * Create notification for all users of a specific type
 */
export async function createBroadcastNotification(userType, type, title, message, priority = 'medium') {
  if (!db) {
    console.log('⚠️ Database not available - cannot create broadcast notification');
    return false;
  }

  try {
    // Get all users of the specified type
    let userQuery;
    if (userType === 'admin' || userType === 'teacher') {
      userQuery = 'SELECT id FROM staff WHERE role = ?';
    } else if (userType === 'parent') {
      userQuery = 'SELECT id FROM users WHERE role = ?';
    } else {
      throw new Error('Invalid user type');
    }

    const [users] = await db.execute(userQuery, [userType]);
    
    if (users.length === 0) {
      console.log(`⚠️ No ${userType} users found for broadcast`);
      return 0;
    }

    const insertQuery = `
      INSERT INTO notifications (
        user_id, user_type, type, title, message, 
        priority, related_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    let insertedCount = 0;
    for (const user of users) {
      try {
        await db.execute(insertQuery, [
          user.id, userType, type, title, message,
          priority, 'broadcast'
        ]);
        insertedCount++;
      } catch (error) {
        console.error(`❌ Error creating notification for ${userType} ${user.id}:`, error.message);
      }
    }

    console.log(`✅ Created broadcast notification for ${insertedCount} ${userType} users`);
    return insertedCount;

  } catch (error) {
    console.error('❌ Error creating broadcast notification:', error);
    return 0;
  }
}
