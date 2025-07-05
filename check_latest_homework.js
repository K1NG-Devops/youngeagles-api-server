import { query, initDatabase } from './src/db.js';

async function checkLatestHomework() {
  try {
    console.log('🔍 Checking latest homework creation...\n');
    
    await initDatabase();
    
    // Check Daniel's homework count
    const danielHomework = await query(`
      SELECT COUNT(*) as count
      FROM homework h
      JOIN children c ON c.class_id = h.class_id
      WHERE c.id = 15
    `);
    console.log(`📚 Daniel Baker has ${danielHomework[0].count} homework assignments`);
    
    // Check teacher's total homework count
    const teacherHomework = await query(`
      SELECT COUNT(*) as count
      FROM homework 
      WHERE teacher_id = 16
    `);
    console.log(`👩‍🏫 Teacher Dimakatso has ${teacherHomework[0].count} total homework assignments`);
    
    // Show the latest homework assignments
    console.log('\n📋 Latest homework assignments (last 5):');
    const latestHomework = await query(`
      SELECT 
        h.id,
        h.title,
        h.subject,
        h.created_at,
        s.name as teacher_name,
        h.status
      FROM homework h
      LEFT JOIN staff s ON s.id = h.teacher_id
      ORDER BY h.created_at DESC
      LIMIT 5
    `);
    
    latestHomework.forEach((hw, index) => {
      const createdTime = new Date(hw.created_at);
      const now = new Date();
      const minutesAgo = Math.round((now - createdTime) / (1000 * 60));
      
      console.log(`   ${index + 1}. ID: ${hw.id} - "${hw.title}"`);
      console.log(`      Subject: ${hw.subject || 'Not specified'}`);
      console.log(`      Teacher: ${hw.teacher_name}`);
      console.log(`      Created: ${minutesAgo} minutes ago`);
      console.log(`      Status: ${hw.status}`);
      console.log('');
    });
    
    // Check specifically for homework created in the last 10 minutes
    console.log('🕐 Homework created in the last 10 minutes:');
    const recentHomework = await query(`
      SELECT 
        h.id,
        h.title,
        h.subject,
        h.created_at,
        s.name as teacher_name
      FROM homework h
      LEFT JOIN staff s ON s.id = h.teacher_id
      WHERE h.created_at >= NOW() - INTERVAL 10 MINUTE
      ORDER BY h.created_at DESC
    `);
    
    if (recentHomework.length > 0) {
      recentHomework.forEach((hw) => {
        console.log(`   ✅ "${hw.title}" (ID: ${hw.id}) - Created: ${hw.created_at}`);
      });
    } else {
      console.log('   ❌ No homework created in the last 10 minutes');
    }
    
  } catch (error) {
    console.error('❌ Error checking homework:', error);
  }
}

// Run the check
checkLatestHomework()
  .then(() => {
    console.log('\n✅ Homework check completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
