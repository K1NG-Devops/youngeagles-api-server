#!/usr/bin/env node

import { query } from '../db.js';

async function fixPushSubscriptionsTable() {
  console.log('🔧 Fixing push_subscriptions table schema...');
  
  try {
    // First, check if the table exists
    const tableExists = await query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'push_subscriptions'
    `);
    
    if (tableExists[0].count === 0) {
      console.log('📦 Creating push_subscriptions table...');
      
      // Create the table with correct schema
      await query(`
        CREATE TABLE push_subscriptions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          userType ENUM('parent', 'teacher', 'student', 'admin') NOT NULL,
          endpoint TEXT NOT NULL,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          isActive BOOLEAN NOT NULL DEFAULT TRUE,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          
          INDEX idx_userId (userId),
          INDEX idx_userType (userType),
          INDEX idx_isActive (isActive),
          INDEX idx_user_active (userId, isActive),
          
          UNIQUE KEY unique_user_endpoint (userId, endpoint(255))
        )
      `);
      
      console.log('✅ push_subscriptions table created successfully');
      
    } else {
      console.log('📋 Table exists, checking schema...');
      
      // Check if userId column exists
      const columns = await query(`
        SELECT COLUMN_NAME 
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() 
        AND table_name = 'push_subscriptions'
      `);
      
      const columnNames = columns.map(col => col.COLUMN_NAME);
      console.log('📊 Current columns:', columnNames);
      
      // Check for missing columns and add them
      const requiredColumns = [
        { name: 'userId', type: 'INT NOT NULL' },
        { name: 'userType', type: "ENUM('parent', 'teacher', 'student', 'admin') NOT NULL" },
        { name: 'endpoint', type: 'TEXT NOT NULL' },
        { name: 'p256dh', type: 'TEXT NOT NULL' },
        { name: 'auth', type: 'TEXT NOT NULL' },
        { name: 'isActive', type: 'BOOLEAN NOT NULL DEFAULT TRUE' },
        { name: 'createdAt', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
      ];
      
      for (const column of requiredColumns) {
        if (!columnNames.includes(column.name)) {
          console.log(`➕ Adding missing column: ${column.name}`);
          await query(`ALTER TABLE push_subscriptions ADD COLUMN ${column.name} ${column.type}`);
        }
      }
      
      // Add indexes if they don't exist
      try {
        await query(`CREATE INDEX idx_userId ON push_subscriptions (userId)`);
        console.log('✅ Added userId index');
      } catch (e) {
        if (!e.message.includes('Duplicate key name')) {
          console.log('ℹ️  userId index already exists');
        }
      }
      
      try {
        await query(`CREATE INDEX idx_userType ON push_subscriptions (userType)`);
        console.log('✅ Added userType index');
      } catch (e) {
        if (!e.message.includes('Duplicate key name')) {
          console.log('ℹ️  userType index already exists');
        }
      }
      
      try {
        await query(`CREATE INDEX idx_isActive ON push_subscriptions (isActive)`);
        console.log('✅ Added isActive index');
      } catch (e) {
        if (!e.message.includes('Duplicate key name')) {
          console.log('ℹ️  isActive index already exists');
        }
      }
    }
    
    // Test the table by running a sample query
    console.log('🧪 Testing table structure...');
    await query(`
      SELECT id, userId, endpoint, p256dh, auth, userType, isActive
      FROM push_subscriptions 
      LIMIT 1
    `);
    
    console.log('✅ Table structure is correct!');
    
    // Record migration
    try {
      await query(`
        INSERT INTO migrations (migration_name) 
        VALUES ('fix_push_subscriptions_table') 
        ON DUPLICATE KEY UPDATE migration_name = migration_name
      `);
      console.log('📝 Migration recorded');
    } catch (e) {
      console.log('ℹ️  Migration table not found, skipping record');
    }
    
    console.log('🎉 Push subscriptions table fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixPushSubscriptionsTable()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fix failed:', error);
      process.exit(1);
    });
}

export default fixPushSubscriptionsTable;
