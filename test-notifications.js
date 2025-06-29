import { query, execute } from './src/db.js';

async function testNotificationSystem() {
  try {
    console.log('🧪 Testing homework notification system...');
    
    // 1. Check if notifications table exists
    try {
      const notifications = await query(
        'SELECT COUNT(*) as count FROM notifications',
        [],
        'skydek_DB'
      );
      console.log(`✅ Notifications table exists with ${notifications[0].count} notifications`);
    } catch (error) {
      console.log('❌ Notifications table does not exist or has issues:', error.message);
      return;
    }
    
    // 2. Get a teacher with class assignment
    const teachers = await query(
      'SELECT id, name, className FROM staff WHERE role = ? AND className IS NOT NULL LIMIT 1',
      ['teacher'],
      'skydek_DB'
    );
    
    if (teachers.length === 0) {
      console.log('❌ No teachers with class assignments found');
      return;
    }
    
    const teacher = teachers[0];
    console.log(`👨‍🏫 Using teacher: ${teacher.name} (ID: ${teacher.id}) - Class: ${teacher.className}`);
    
    // 3. Get parents in this teacher's class
    const parents = await query(
      `SELECT DISTINCT c.parent_id, u.name as parent_name 
       FROM children c 
       LEFT JOIN users u ON c.parent_id = u.id 
       WHERE c.className = ?`,
      [teacher.className],
      'skydek_DB'
    );
    
    console.log(`👨‍👩‍👧‍👦 Found ${parents.length} parents in class ${teacher.className}:`);
    parents.forEach(parent => {
      console.log(`  - ${parent.parent_name} (ID: ${parent.parent_id})`);
    });
    
    if (parents.length === 0) {
      console.log('❌ No parents found in this class');
      return;
    }
    
    // 4. Test creating a notification
    const testTitle = 'Test Homework Notification 📚';
    const testBody = `Teacher ${teacher.name} posted "Test Assignment" for your child's class.`;
    
    console.log('\n🔔 Creating test notifications...');
    
    let successCount = 0;
    for (const parent of parents) {
      if (!parent.parent_id) {
        console.log(`⚠️ Skipping parent with null ID`);
        continue;
      }
      
      try {
                 await execute(
           `INSERT INTO notifications (userId, userType, title, body, type, isRead, createdAt, updatedAt) 
            VALUES (?, 'parent', ?, ?, 'homework', FALSE, NOW(), NOW())`,
           [
             parent.parent_id,
             testTitle,
             testBody
           ],
           'skydek_DB'
         );
        console.log(`✅ Created notification for parent ${parent.parent_id} (${parent.parent_name})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to create notification for parent ${parent.parent_id}:`, error.message);
      }
    }
    
    console.log(`\n📊 Results: ${successCount}/${parents.length} notifications created successfully`);
    
    // 5. Verify notifications were created
    const createdNotifications = await query(
      'SELECT * FROM notifications WHERE title = ? ORDER BY createdAt DESC',
      [testTitle],
      'skydek_DB'
    );
    
    console.log(`\n✅ Verification: ${createdNotifications.length} test notifications found in database`);
    
    // 6. Clean up test notifications
    await execute(
      'DELETE FROM notifications WHERE title = ?',
      [testTitle],
      'skydek_DB'
    );
    
    console.log('🧹 Test notifications cleaned up');
    console.log('\n🎉 Notification system test completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`   - Teacher: ${teacher.name} (${teacher.className} class)`);
    console.log(`   - Parents: ${parents.length} found`);
    console.log(`   - Notifications: ${successCount} created successfully`);
    console.log('\n✅ Parents should now receive notifications when teachers post homework!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing notification system:', error);
    process.exit(1);
  }
}

testNotificationSystem(); 