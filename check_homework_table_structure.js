import { initDatabase, query, close } from './src/db.js';

async function checkTableStructure() {
  try {
    console.log('🔌 Connecting to database...');
    
    // Initialize database
    const connected = await initDatabase();
    if (!connected) {
      console.log('❌ Failed to connect to database');
      return false;
    }
    
    console.log('✅ Database connected successfully!');
    
    // Check for homework_individual_assignments table
    const tables = await query('SHOW TABLES');
    const hasIndividualTable = tables.some(table => 
      Object.values(table)[0] === 'homework_individual_assignments'
    );
    
    console.log(`\n📋 Individual assignments table exists: ${hasIndividualTable ? '✅' : '❌'}`);
    
    if (hasIndividualTable) {
      console.log('\n📊 Structure of homework_individual_assignments table:');
      const structure = await query('DESCRIBE homework_individual_assignments');
      console.table(structure);
      
      // Show sample data
      console.log('\n📝 Sample data from homework_individual_assignments:');
      const sampleData = await query('SELECT * FROM homework_individual_assignments LIMIT 5');
      if (sampleData.length > 0) {
        console.table(sampleData);
      } else {
        console.log('ℹ️  No data found in homework_individual_assignments table');
      }
      
      // Check specifically for homework ID 29
      console.log('\n🔍 Checking for any entries related to homework ID 29:');
      const homework29Data = await query('SELECT * FROM homework_individual_assignments WHERE homework_id = 29');
      if (homework29Data.length > 0) {
        console.table(homework29Data);
      } else {
        console.log('ℹ️  No submissions found for homework ID 29');
      }
    }
    
    // Check if there's a homework_submissions table
    const hasSubmissionsTable = tables.some(table => 
      Object.values(table)[0] === 'homework_submissions'
    );
    
    if (hasSubmissionsTable) {
      console.log('\n📋 Found homework_submissions table');
      console.log('\n📊 Structure of homework_submissions table:');
      const submissionsStructure = await query('DESCRIBE homework_submissions');
      console.table(submissionsStructure);
      
      // Check for homework ID 29 in submissions table
      console.log('\n🔍 Checking homework_submissions for homework ID 29:');
      const submissionsData = await query('SELECT * FROM homework_submissions WHERE homework_id = 29');
      if (submissionsData.length > 0) {
        console.table(submissionsData);
      } else {
        console.log('ℹ️  No submissions found for homework ID 29 in homework_submissions');
      }
    }
    
    // List all tables to see what submission-related tables exist
    console.log('\n📋 All tables in database:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`  - ${tableName}`);
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    return false;
  } finally {
    await close();
  }
}

// Run the script
console.log('🔧 Checking homework table structures...');

checkTableStructure()
  .then(success => {
    if (success) {
      console.log('\n✅ Check completed successfully!');
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
