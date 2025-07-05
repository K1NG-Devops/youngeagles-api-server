import { initDatabase, query, close } from './src/db.js';

async function simpleTableCheck() {
  try {
    console.log('🔌 Connecting to database...');
    
    // Initialize database
    const connected = await initDatabase();
    if (!connected) {
      console.log('❌ Failed to connect to database');
      return false;
    }
    
    console.log('✅ Database connected successfully!');
    
    // Check if homework_submissions table exists and its structure
    try {
      console.log('\n📊 Checking homework_submissions table structure:');
      const hsStructure = await query('DESCRIBE homework_submissions');
      console.table(hsStructure);
    } catch (e) {
      console.log('❌ homework_submissions table does not exist or error:', e.message);
    }
    
    // Check homework_individual_assignments structure
    try {
      console.log('\n📊 Checking homework_individual_assignments table structure:');
      const hiaStructure = await query('DESCRIBE homework_individual_assignments');
      console.table(hiaStructure);
    } catch (e) {
      console.log('❌ homework_individual_assignments table does not exist or error:', e.message);
    }
    
    // Just show what data exists for homework ID 29 in any submission-related tables
    console.log('\n🔍 Checking for any data related to homework ID 29:');
    
    // Check homework table first
    try {
      const homework29 = await query('SELECT * FROM homework WHERE id = 29');
      if (homework29.length > 0) {
        console.log('\n📋 Homework ID 29 details:');
        console.table(homework29);
      }
    } catch (e) {
      console.log('❌ Error checking homework table:', e.message);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    return false;
  } finally {
    await close();
  }
}

// Run the script
console.log('🔧 Simple table structure check...');

simpleTableCheck()
  .then(success => {
    if (success) {
      console.log('\n✅ Check completed!');
      process.exit(0);
    } else {
      console.log('\n❌ Check failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
