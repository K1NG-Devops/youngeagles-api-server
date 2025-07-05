import { initDatabase, query, execute, close } from './src/db.js';

async function fixHomeworkContentType() {
  try {
    console.log('🔌 Connecting to database...');
    
    // Initialize database
    const connected = await initDatabase();
    if (!connected) {
      console.log('❌ Failed to connect to database');
      return false;
    }
    
    console.log('✅ Database connected successfully!');
    
    // Check current content_type for homework ID 29
    const rows = await query(
      'SELECT id, title, content_type FROM homework WHERE id = ?',
      [29]
    );
    
    if (rows.length === 0) {
      console.log('❌ Homework ID 29 not found in database');
      return false;
    }
    
    const homework = rows[0];
    console.log(`Found homework ID ${homework.id}: '${homework.title}'`);
    console.log(`Current content_type: ${homework.content_type}`);
    
    // Check if it needs to be updated
    if (homework.content_type === 'interactive') {
      console.log('✅ Content type is already "interactive" - no update needed');
      return true;
    }
    
    // Update content_type to 'interactive'
    const result = await execute(
      'UPDATE homework SET content_type = ? WHERE id = ?',
      ['interactive', 29]
    );
    
    console.log(`📝 Update result: ${result.affectedRows} row(s) affected`);
    
    // Verify the update
    const verifyRows = await query(
      'SELECT content_type FROM homework WHERE id = ?',
      [29]
    );
    
    const newContentType = verifyRows[0].content_type;
    
    if (newContentType === 'interactive') {
      console.log('✅ Successfully updated homework ID 29 content_type to "interactive"');
      return true;
    } else {
      console.log(`❌ Update failed - content_type is still '${newContentType}'`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    return false;
  } finally {
    await close();
  }
}

// Run the script
console.log('🔧 Checking and fixing homework content type for ID 29...');

fixHomeworkContentType()
  .then(success => {
    if (success) {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Script failed - please check the error messages above');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
