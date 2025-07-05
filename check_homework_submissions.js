import { initDatabase, query, close } from './src/db.js';

async function checkHomeworkSubmissions() {
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
      // Check submissions for homework ID 29
      console.log('\n🔍 Checking submissions for homework ID 29...');
      
      const submissions = await query(`
        SELECT 
          hia.id,
          hia.user_id,
          hia.homework_id,
          hia.status,
          hia.submitted_at,
          hia.graded_at,
          hia.score,
          hia.created_at,
          u.first_name,
          u.last_name,
          h.title as homework_title,
          h.content_type
        FROM homework_individual_assignments hia
        JOIN users u ON hia.user_id = u.id
        JOIN homework h ON hia.homework_id = h.id
        WHERE hia.homework_id = 29
        ORDER BY hia.created_at DESC
      `);
      
      if (submissions.length === 0) {
        console.log('ℹ️  No submissions found for homework ID 29');
      } else {
        console.log(`\n📊 Found ${submissions.length} submission(s) for homework ID 29:`);
        console.log('ID | Student | Status | Submitted | Score | Created');
        console.log('---|---------|--------|-----------|-------|--------');
        
        submissions.forEach(sub => {
          const studentName = `${sub.first_name} ${sub.last_name}`;
          const submittedAt = sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'Not submitted';
          const score = sub.score !== null ? sub.score : 'Not graded';
          const createdAt = new Date(sub.created_at).toLocaleString();
          
          console.log(`${sub.id.toString().padStart(2)} | ${studentName.substring(0, 15).padEnd(15)} | ${sub.status.padEnd(8)} | ${submittedAt.substring(0, 16).padEnd(16)} | ${score.toString().padEnd(5)} | ${createdAt.substring(0, 16)}`);
        });
        
        // Check for any submissions that might be in an inconsistent state
        const problemSubmissions = submissions.filter(sub => 
          sub.status === 'assigned' && sub.submitted_at !== null
        );
        
        if (problemSubmissions.length > 0) {
          console.log('\n⚠️  Found submissions with inconsistent status:');
          problemSubmissions.forEach(sub => {
            console.log(`  - ID ${sub.id}: Status is '${sub.status}' but has submitted_at timestamp`);
          });
          
          console.log('\n🔧 These submissions should probably have status "submitted" or "graded"');
        }
      }
    }
    
    // Also check if there's a general homework_submissions table
    const hasSubmissionsTable = tables.some(table => 
      Object.values(table)[0] === 'homework_submissions'
    );
    
    if (hasSubmissionsTable) {
      console.log('\n📋 Also checking homework_submissions table...');
      
      const generalSubmissions = await query(`
        SELECT 
          hs.*,
          u.first_name,
          u.last_name,
          h.title as homework_title,
          h.content_type
        FROM homework_submissions hs
        JOIN users u ON hs.user_id = u.id
        JOIN homework h ON hs.homework_id = h.id
        WHERE hs.homework_id = 29
        ORDER BY hs.created_at DESC
      `);
      
      if (generalSubmissions.length > 0) {
        console.log(`\n📊 Found ${generalSubmissions.length} submission(s) in homework_submissions for ID 29:`);
        console.table(generalSubmissions);
      }
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
console.log('🔧 Checking homework submissions for ID 29...');

checkHomeworkSubmissions()
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
