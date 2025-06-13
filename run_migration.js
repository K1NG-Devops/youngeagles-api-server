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

async function runChildIdMigration() {
  console.log('🚀 Starting child_id migration...');
  
  try {
    const dbName = 'skydek_DB'; // Use the correct database name
    
    // Add child_id column to submissions table
    console.log('📊 Checking submissions table for child_id column...');
    const submissionsHasChildId = await columnExists('submissions', 'child_id', dbName);
    
    if (!submissionsHasChildId) {
      console.log('📊 Adding child_id column to submissions table...');
      await execute(
        'ALTER TABLE submissions ADD COLUMN child_id INT NULL AFTER parent_id',
        [],
        'skydek_DB'
      );
      console.log('✅ child_id column added to submissions table');
    } else {
      console.log('ℹ️  child_id column already exists in submissions table');
    }
    
    // Add indexes for submissions table
    console.log('📊 Checking indexes on submissions table...');
    
    const hasChildIdIndex = await indexExists('submissions', 'idx_submissions_child_id', dbName);
    if (!hasChildIdIndex) {
      console.log('📊 Adding child_id index to submissions table...');
      await execute(
        'ALTER TABLE submissions ADD INDEX idx_submissions_child_id (child_id)',
        [],
        'skydek_DB'
      );
      console.log('✅ Added index for child_id on submissions');
    } else {
      console.log('ℹ️  Index idx_submissions_child_id already exists');
    }
    
    const hasCompositeIndex = await indexExists('submissions', 'idx_submissions_parent_child', dbName);
    if (!hasCompositeIndex) {
      console.log('📊 Adding composite index to submissions table...');
      await execute(
        'ALTER TABLE submissions ADD INDEX idx_submissions_parent_child (parent_id, child_id)',
        [],
        'skydek_DB'
      );
      console.log('✅ Added composite index for parent_id, child_id on submissions');
    } else {
      console.log('ℹ️  Index idx_submissions_parent_child already exists');
    }
    
    // Create homework_completions table if it doesn't exist
    console.log('📊 Creating homework_completions table...');
    await execute(`
      CREATE TABLE IF NOT EXISTS homework_completions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        homework_id INT NOT NULL,
        parent_id INT NOT NULL,
        child_id INT NULL,
        completion_answer TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_homework_completions_homework_id (homework_id),
        INDEX idx_homework_completions_parent_id (parent_id),
        INDEX idx_homework_completions_child_id (child_id)
      )
    `, [], 'skydek_DB');
    console.log('✅ homework_completions table created/verified');
    
    // Add child_id column to homework_completions if it doesn't exist
    console.log('📊 Checking homework_completions table for child_id column...');
    const homeworkHasChildId = await columnExists('homework_completions', 'child_id', dbName);
    
    if (!homeworkHasChildId) {
      console.log('📊 Adding child_id column to homework_completions table...');
      await execute(
        'ALTER TABLE homework_completions ADD COLUMN child_id INT NULL AFTER parent_id',
        [],
        'skydek_DB'
      );
      console.log('✅ child_id column added to homework_completions table');
    } else {
      console.log('ℹ️  child_id column already exists in homework_completions table');
    }
    
    // Try to add unique constraint
    console.log('📊 Checking for unique constraint...');
    const hasUniqueConstraint = await indexExists('homework_completions', 'unique_homework_parent_child', dbName);
    
    if (!hasUniqueConstraint) {
      console.log('📊 Adding unique constraint...');
      try {
        await execute(
          'ALTER TABLE homework_completions ADD UNIQUE KEY unique_homework_parent_child (homework_id, parent_id, child_id)',
          [],
          'skydek_DB'
        );
        console.log('✅ Added unique constraint for homework_completions');
      } catch (e) {
        console.log('⚠️  Could not add unique constraint:', e.message);
      }
    } else {
      console.log('ℹ️  Unique constraint already exists');
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

runChildIdMigration();

