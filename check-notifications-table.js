import { query } from './src/db.js';

async function checkNotificationsTable() {
  try {
    console.log('🔍 Checking notifications table structure...');
    
    // Check table structure
    const columns = await query(
      'DESCRIBE notifications',
      [],
      'skydek_DB'
    );
    
    console.log('\n📋 Notifications table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
    });
    
    // Check a few sample notifications
    const sampleNotifications = await query(
      'SELECT * FROM notifications LIMIT 3',
      [],
      'skydek_DB'
    );
    
    console.log('\n📄 Sample notifications:');
    if (sampleNotifications.length > 0) {
      sampleNotifications.forEach((notif, index) => {
        console.log(`\n  ${index + 1}. ID: ${notif.id}`);
        console.log(`     Title: ${notif.title}`);
        console.log(`     UserType: ${notif.userType}`);
        console.log(`     Type: ${notif.type}`);
        console.log(`     Read status: ${notif.read !== undefined ? notif.read : notif.isRead !== undefined ? notif.isRead : 'unknown field'}`);
        console.log(`     Created: ${notif.createdAt || notif.created_at}`);
      });
    } else {
      console.log('  No notifications found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkNotificationsTable(); 