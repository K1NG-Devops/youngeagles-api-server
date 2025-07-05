import { query, initDatabase } from './src/db.js';

async function testChildAccess() {
  try {
    console.log('🧪 Testing child ID 15 access for homework submission...\n');
    
    await initDatabase();
    
    // Test the exact query used in the homework submission endpoint
    console.log('🔍 Testing child lookup query (used in homework submission):');
    const [child] = await query(`
      SELECT c.*, cl.name as class_name
      FROM children c
      LEFT JOIN classes cl ON cl.id = c.class_id
      WHERE c.id = ?
    `, [15]);
    
    if (child) {
      console.log('✅ Child found successfully:');
      console.log(`  ID: ${child.id}`);
      console.log(`  Name: ${child.first_name} ${child.last_name}`);
      console.log(`  Class: ${child.class_name}`);
      console.log(`  Parent ID: ${child.parent_id}`);
      console.log(`  Class ID: ${child.class_id}`);
    } else {
      console.log('❌ Child ID 15 not found using submission query');
      return;
    }
    
    // Test homework 29 access
    console.log('\n📚 Testing homework 29 access:');
    const [homework] = await query(`
      SELECT 
        h.*,
        cl.name as class_name,
        s.name as teacher_name
      FROM homework h
      LEFT JOIN classes cl ON cl.id = h.class_id
      LEFT JOIN staff s ON s.id = h.teacher_id
      WHERE h.id = ?
    `, [29]);
    
    if (homework) {
      console.log('✅ Homework 29 found:');
      console.log(`  Title: ${homework.title}`);
      console.log(`  Content Type: ${homework.content_type}`);
      console.log(`  Class: ${homework.class_name}`);
      console.log(`  Teacher: ${homework.teacher_name}`);
    } else {
      console.log('❌ Homework 29 not found');
      return;
    }
    
    // Test existing submission check
    console.log('\n🔍 Testing existing submission check:');
    const [existingSubmission] = await query(`
      SELECT id, status FROM homework_submissions 
      WHERE homework_id = ? AND child_id = ?
    `, [29, 15]);
    
    if (existingSubmission) {
      console.log('⚠️ Existing submission found:');
      console.log(`  Submission ID: ${existingSubmission.id}`);
      console.log(`  Status: ${existingSubmission.status}`);
      console.log('  → This would prevent new submission');
    } else {
      console.log('✅ No existing submission found');
      console.log('  → New submission would be allowed');
    }
    
    // Simulate the permission check
    console.log('\n🔐 Testing permission check for parent-child relationship:');
    if (child.parent_id === 25) {
      console.log('✅ Permission check would pass for parent ID 25');
      console.log(`  Child ${child.first_name} belongs to parent ${child.parent_id}`);
    } else {
      console.log(`❌ Permission check would fail`);
      console.log(`  Child belongs to parent ${child.parent_id}, not 25`);
    }
    
    // Test URL parameter formats
    console.log('\n🌐 URL parameter format testing:');
    console.log('Correct URLs should be:');
    console.log(`  - View Details: /homework/29/details?child_id=15`);
    console.log(`  - Start Homework: /homework/29/details?child_id=15`);
    console.log(`  - Submit Work: /submit-work?homework_id=29&child_id=15`);
    
    console.log('\n📊 Summary:');
    console.log(`  ✅ Child ID 15 exists: ${child ? 'YES' : 'NO'}`);
    console.log(`  ✅ Homework 29 exists: ${homework ? 'YES' : 'NO'}`);
    console.log(`  ✅ No existing submission: ${!existingSubmission ? 'YES' : 'NO'}`);
    console.log(`  ✅ Parent permission valid: ${child?.parent_id === 25 ? 'YES' : 'NO'}`);
    
    if (child && homework && !existingSubmission && child.parent_id === 25) {
      console.log('\n🎉 ALL CHECKS PASSED - Homework submission should work!');
    } else {
      console.log('\n⚠️ Some checks failed - review issues above');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testChildAccess()
  .then(() => {
    console.log('\n✅ Child access test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
