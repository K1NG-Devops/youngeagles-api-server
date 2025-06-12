import { query, execute } from './src/db.js';

async function runChildIdMigration() {
  console.log('🚀 Starting child_id migration...');
  
  try {
    // Add child_id column to submissions table
    console.log('📊 Adding child_id column to submissions table...');
    await execute(
      'ALTER TABLE submissions ADD COLUMN IF NOT EXISTS child_id INT NULL AFTER parent_id',
      [],
      'skydek_DB'
    );
    console.log('✅ child_id column added to submissions table');
    
    // Add indexes for submissions table
    console.log('📊 Adding indexes to submissions table...');
    try {
      await execute(
        'ALTER TABLE submissions ADD INDEX IF NOT EXISTS idx_submissions_child_id (child_id)',
        [],
        'skydek_DB'
      );
      console.log('✅ Added index for child_id on submissions');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) {
        throw e;
      }
      console.log('ℹ️  Index idx_submissions_child_id already exists');
    }
    
    try {
      await execute(
        'ALTER TABLE submissions ADD INDEX IF NOT EXISTS idx_submissions_parent_child (parent_id, child_id)',
        [],
        'skydek_DB'
      );
      console.log('✅ Added composite index for parent_id, child_id on submissions');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) {
        throw e;
      }
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
    console.log('📊 Adding child_id column to homework_completions table...');
    try {
      await execute(
        'ALTER TABLE homework_completions ADD COLUMN IF NOT EXISTS child_id INT NULL AFTER parent_id',
        [],
        'skydek_DB'
      );
      console.log('✅ child_id column added to homework_completions table');
    } catch (e) {
      if (!e.message.includes('Duplicate column name')) {
        throw e;
      }
      console.log('ℹ️  child_id column already exists in homework_completions');
    }
    
    // Try to add unique constraint
    console.log('📊 Adding unique constraint...');
    try {
      await execute(
        'ALTER TABLE homework_completions ADD UNIQUE KEY IF NOT EXISTS unique_homework_parent_child (homework_id, parent_id, child_id)',
        [],
        'skydek_DB'
      );
      console.log('✅ Added unique constraint for homework_completions');
    } catch (e) {
      if (!e.message.includes('Duplicate key name')) {
        console.log('⚠️  Could not add unique constraint (may already exist):', e.message);
      } else {
        console.log('ℹ️  Unique constraint already exists');
      }
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

runChildIdMigration();

