import { query, execute } from './src/db.js';

// Helper function to check if column exists
async function columnExists(tableName, columnName, database) {
  try {
    const result = await query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [database, tableName, columnName],
      database
    );
    return result[0].count > 0;
  } catch (error) {
    console.error(`Error checking if column ${columnName} exists in ${tableName}:`, error);
    return false;
  }
}

// Helper function to check if index exists
async function indexExists(tableName, indexName, database) {
  try {
    const result = await query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [database, tableName, indexName],
      database
    );
    return result[0].count > 0;
  } catch (error) {
    console.error(`Error checking if index ${indexName} exists in ${tableName}:`, error);
    return false;
  }
}

async function runFirebaseUidMigration() {
  console.log('🚀 Starting firebase_uid migration...');
  
  try {
    const dbName = 'skydek_DB'; // Use the correct database name
    
    // Add firebase_uid column to users table
    console.log('📊 Checking users table for firebase_uid column...');
    const usersHasFirebaseUid = await columnExists('users', 'firebase_uid', dbName);
    
    if (!usersHasFirebaseUid) {
      console.log('📊 Adding firebase_uid column to users table...');
      await execute(
        'ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(255) NULL UNIQUE AFTER id',
        [],
        'skydek_DB'
      );
      console.log('✅ firebase_uid column added to users table');
    } else {
      console.log('ℹ️  firebase_uid column already exists in users table');
    }
    
    // Add index for firebase_uid column
    console.log('📊 Checking indexes on users table...');
    
    const hasFirebaseUidIndex = await indexExists('users', 'idx_users_firebase_uid', dbName);
    if (!hasFirebaseUidIndex) {
      console.log('📊 Adding firebase_uid index to users table...');
      await execute(
        'ALTER TABLE users ADD INDEX idx_users_firebase_uid (firebase_uid)',
        [],
        'skydek_DB'
      );
      console.log('✅ Added index for firebase_uid on users');
    } else {
      console.log('ℹ️  Index idx_users_firebase_uid already exists');
    }
    
    console.log('🎉 Firebase UID migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Firebase UID migration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

runFirebaseUidMigration();

