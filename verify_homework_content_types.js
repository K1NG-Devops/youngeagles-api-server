import { initDatabase, query, close } from './src/db.js';

async function verifyHomeworkContentTypes() {
  try {
    console.log('🔌 Connecting to database...');
    
    // Initialize database
    const connected = await initDatabase();
    if (!connected) {
      console.log('❌ Failed to connect to database');
      return false;
    }
    
    console.log('✅ Database connected successfully!');
    
    // Check all homework content types
    const rows = await query(
      'SELECT id, title, content_type FROM homework ORDER BY id'
    );
    
    console.log(`\n📊 Found ${rows.length} homework entries:`);
    console.log('ID | Title | Content Type');
    console.log('---|-------|-------------');
    
    let traditionalCount = 0;
    let interactiveCount = 0;
    let nullCount = 0;
    
    rows.forEach(homework => {
      const contentType = homework.content_type || 'NULL';
      console.log(`${homework.id.toString().padStart(2)} | ${homework.title.substring(0, 30).padEnd(30)} | ${contentType}`);
      
      if (homework.content_type === 'traditional') {
        traditionalCount++;
      } else if (homework.content_type === 'interactive') {
        interactiveCount++;
      } else {
        nullCount++;
      }
    });
    
    console.log('\n📈 Summary:');
    console.log(`  Traditional: ${traditionalCount}`);
    console.log(`  Interactive: ${interactiveCount}`);
    console.log(`  NULL/Other: ${nullCount}`);
    
    // Check for potential mismatches (homework that should be interactive but isn't)
    const potentialMismatches = await query(`
      SELECT id, title, content_type, assignment_type 
      FROM homework 
      WHERE content_type != 'interactive' AND (
        title LIKE '%interactive%' OR 
        title LIKE '%click%' OR 
        title LIKE '%drag%' OR
        assignment_type = 'interactive'
      )
    `);
    
    if (potentialMismatches.length > 0) {
      console.log('\n⚠️  Potential content type mismatches found:');
      potentialMismatches.forEach(hw => {
        console.log(`  ID ${hw.id}: "${hw.title}" (${hw.content_type})`);
      });
    } else {
      console.log('\n✅ No obvious content type mismatches found');
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
console.log('🔧 Verifying homework content types...');

verifyHomeworkContentTypes()
  .then(success => {
    if (success) {
      console.log('\n✅ Verification completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Verification failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
