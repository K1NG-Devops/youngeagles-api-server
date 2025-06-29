import { execute, query } from './src/db.js';

async function runEnhancedMessagingMigration() {
  console.log('🚀 Running Enhanced Messaging Migration...');
  
  try {
    // Add basic columns to messages table
    console.log('📝 Adding enhanced columns to messages table...');
    
    const messageCols = [
      'ADD COLUMN thread_id INT NULL',
      'ADD COLUMN reply_to_message_id INT NULL', 
      'ADD COLUMN message_status ENUM("sent", "delivered", "read") DEFAULT "sent"',
      'ADD COLUMN read_at TIMESTAMP NULL',
      'ADD COLUMN delivered_at TIMESTAMP NULL',
      'ADD COLUMN is_edited BOOLEAN DEFAULT FALSE',
      'ADD COLUMN attachment_type ENUM("image", "file", "voice", "video") NULL',
      'ADD COLUMN message_priority ENUM("low", "normal", "high", "urgent") DEFAULT "normal"'
    ];
    
    for (const col of messageCols) {
      try {
        await execute(`ALTER TABLE messages ${col}`, [], 'skydek_DB');
        console.log(`✅ Added column: ${col.split(' ')[2]}`);
      } catch (error) {
        if (error.message.includes('Duplicate column')) {
          console.log(`⚠️ Column already exists: ${col.split(' ')[2]}`);
        } else {
          console.error(`❌ Error adding column: ${error.message}`);
        }
      }
    }
    
    // Create message_reactions table
    console.log('📝 Creating message_reactions table...');
    try {
      await execute(`
        CREATE TABLE IF NOT EXISTS message_reactions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          message_id INT NOT NULL,
          user_id INT NOT NULL,
          user_type ENUM('parent', 'teacher', 'admin') NOT NULL,
          reaction_emoji VARCHAR(10) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_message_reactions (message_id),
          UNIQUE KEY unique_user_reaction (message_id, user_id, user_type, reaction_emoji)
        )
      `, [], 'skydek_DB');
      console.log('✅ Created message_reactions table');
    } catch (error) {
      console.log('⚠️ message_reactions table already exists');
    }
    
    // Create user_presence table
    console.log('📝 Creating user_presence table...');
    try {
      await execute(`
        CREATE TABLE IF NOT EXISTS user_presence (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          user_type ENUM('parent', 'teacher', 'admin') NOT NULL,
          status ENUM('online', 'away', 'busy', 'offline') DEFAULT 'offline',
          last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          socket_id VARCHAR(100) NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_presence (user_id, user_type),
          INDEX idx_status (status)
        )
      `, [], 'skydek_DB');
      console.log('✅ Created user_presence table');
    } catch (error) {
      console.log('⚠️ user_presence table already exists');
    }
    
    // Create typing_indicators table
    console.log('📝 Creating typing_indicators table...');
    try {
      await execute(`
        CREATE TABLE IF NOT EXISTS typing_indicators (
          id INT PRIMARY KEY AUTO_INCREMENT,
          conversation_id VARCHAR(100) NOT NULL,
          user_id INT NOT NULL,
          user_type ENUM('parent', 'teacher', 'admin') NOT NULL,
          is_typing BOOLEAN DEFAULT TRUE,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          UNIQUE KEY unique_typing (conversation_id, user_id, user_type),
          INDEX idx_conversation_typing (conversation_id)
        )
      `, [], 'skydek_DB');
      console.log('✅ Created typing_indicators table');
    } catch (error) {
      console.log('⚠️ typing_indicators table already exists');
    }
    
    // Create notification_preferences table
    console.log('📝 Creating notification_preferences table...');
    try {
      await execute(`
        CREATE TABLE IF NOT EXISTS notification_preferences (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          user_type ENUM('parent', 'teacher', 'admin') NOT NULL,
          notification_type ENUM('message', 'homework', 'announcement', 'urgent') NOT NULL,
          enabled BOOLEAN DEFAULT TRUE,
          sound_enabled BOOLEAN DEFAULT TRUE,
          vibration_enabled BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_notification_type (user_id, user_type, notification_type)
        )
      `, [], 'skydek_DB');
      console.log('✅ Created notification_preferences table');
    } catch (error) {
      console.log('⚠️ notification_preferences table already exists');
    }
    
    // Insert default notification preferences for existing users
    console.log('📝 Setting up default notification preferences...');
    try {
      // Get all users and staff
      const users = await query('SELECT id FROM users WHERE role = "parent"', [], 'skydek_DB');
      const staff = await query('SELECT id, role FROM staff WHERE role IN ("teacher", "admin")', [], 'skydek_DB');
      
      const notificationTypes = ['message', 'homework', 'announcement', 'urgent'];
      
      // Add preferences for parents
      for (const user of users) {
        for (const notType of notificationTypes) {
          try {
            await execute(`
              INSERT IGNORE INTO notification_preferences 
              (user_id, user_type, notification_type, enabled) 
              VALUES (?, 'parent', ?, TRUE)
            `, [user.id, notType], 'skydek_DB');
          } catch (error) {
            // Ignore duplicates
          }
        }
      }
      
      // Add preferences for staff
      for (const staffMember of staff) {
        for (const notType of notificationTypes) {
          try {
            await execute(`
              INSERT IGNORE INTO notification_preferences 
              (user_id, user_type, notification_type, enabled) 
              VALUES (?, ?, ?, TRUE)
            `, [staffMember.id, staffMember.role, notType], 'skydek_DB');
          } catch (error) {
            // Ignore duplicates
          }
        }
      }
      
      console.log(`✅ Set up notification preferences for ${users.length} parents and ${staff.length} staff members`);
    } catch (error) {
      console.error('❌ Error setting up notification preferences:', error.message);
    }
    
    console.log('🎉 Enhanced Messaging Migration completed successfully!');
    console.log('');
    console.log('🚀 New Features Available:');
    console.log('  ✅ Read Receipts & Delivery Status');
    console.log('  ✅ Online/Offline Presence Indicators');
    console.log('  ✅ Typing Indicators');
    console.log('  ✅ Message Reactions (Emojis)');
    console.log('  ✅ Message Threading (Replies)');
    console.log('  ✅ Priority Messages (Urgent/Normal)');
    console.log('  ✅ Smart Notification Preferences');
    console.log('  ✅ Enhanced WebSocket Events');
    console.log('');
    console.log('📡 API Endpoints:');
    console.log('  • /api/messaging-enhanced/send-enhanced');
    console.log('  • /api/messaging-enhanced/conversations-enhanced');
    console.log('  • /api/messaging-enhanced/messages/:messageId/reactions');
    console.log('  • /api/messaging-enhanced/presence');
    console.log('  • /api/messaging-enhanced/typing');
    console.log('');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
runEnhancedMessagingMigration()
  .then(() => {
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }); 