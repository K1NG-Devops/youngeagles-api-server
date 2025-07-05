import { query, initDatabase } from './src/db.js';

async function testHomeworkSimple() {
  try {
    console.log('🧪 Simple homework system test...\n');
    
    await initDatabase();
    
    // Test 1: Check Daniel Baker's homework visibility
    console.log('👦 Testing Daniel Baker homework:');
    const [daniel] = await query(`
      SELECT id, first_name, last_name, parent_id, class_id
      FROM children 
      WHERE first_name = 'Daniel' AND last_name = 'Baker'
    `);
    
    if (daniel) {
      console.log(`   ✅ Found Daniel Baker: ID ${daniel.id}, Parent: ${daniel.parent_id}, Class: ${daniel.class_id}`);
      
      // Count homework for Daniel's class
      const classHomework = await query(`
        SELECT COUNT(*) as count
        FROM homework h
        WHERE h.class_id = ? AND h.status = 'active'
      `, [daniel.class_id]);
      
      console.log(`   📚 Class homework count: ${classHomework[0].count}`);
      
      // List recent homework for Daniel's class
      const recentHomework = await query(`
        SELECT h.id, h.title, h.assignment_type, h.teacher_id, s.name as teacher_name
        FROM homework h
        LEFT JOIN staff s ON s.id = h.teacher_id
        WHERE h.class_id = ? AND h.status = 'active'
        ORDER BY h.created_at DESC
        LIMIT 5
      `, [daniel.class_id]);
      
      console.log(`   📋 Recent homework for Daniel's class:`);
      recentHomework.forEach((hw, index) => {
        console.log(`      ${index + 1}. "${hw.title}" (${hw.assignment_type || 'class'}) by ${hw.teacher_name}`);
      });
      
      // Individual homework for Daniel
      const individualHomework = await query(`
        SELECT h.id, h.title, hia.status
        FROM homework h
        JOIN homework_individual_assignments hia ON hia.homework_id = h.id
        WHERE hia.child_id = ? AND h.status = 'active'
      `, [daniel.id]);
      
      console.log(`   👤 Individual homework for Daniel: ${individualHomework.length}`);
      if (individualHomework.length > 0) {
        individualHomework.forEach((hw, index) => {
          console.log(`      ${index + 1}. "${hw.title}" (Status: ${hw.status})`);
        });
      }
      
      // Parent view test (without problematic DISTINCT ORDER BY)
      const parentHomework = await query(`
        SELECT 
          h.id,
          h.title,
          h.assignment_type,
          c.first_name as child_name,
          c.last_name as child_last_name,
          s.name as teacher_name
        FROM children c
        JOIN homework h ON h.class_id = c.class_id
        LEFT JOIN staff s ON s.id = h.teacher_id
        WHERE c.parent_id = ? AND h.status = 'active' AND h.assignment_type = 'class'
        
        UNION
        
        SELECT 
          h.id,
          h.title,
          h.assignment_type,
          c.first_name as child_name,
          c.last_name as child_last_name,
          s.name as teacher_name
        FROM children c
        JOIN homework_individual_assignments hia ON hia.child_id = c.id
        JOIN homework h ON h.id = hia.homework_id
        LEFT JOIN staff s ON s.id = h.teacher_id
        WHERE c.parent_id = ? AND h.status = 'active' AND h.assignment_type = 'individual'
      `, [daniel.parent_id, daniel.parent_id]);
      
      console.log(`   👪 Total homework visible to parent: ${parentHomework.length}`);
      
    } else {
      console.log('   ❌ Daniel Baker not found');
    }
    
    // Test 2: Check teacher homework count
    console.log('\n👩‍🏫 Testing teacher homework view:');
    const [teacher] = await query(`
      SELECT id, name, className 
      FROM staff 
      WHERE name LIKE '%Dimakatso%' AND role = 'teacher'
    `);
    
    if (teacher) {
      console.log(`   ✅ Found teacher: ${teacher.name} (Class: ${teacher.className})`);
      
      const teacherHomework = await query(`
        SELECT 
          h.id, 
          h.title, 
          h.assignment_type,
          h.created_at
        FROM homework h
        WHERE h.teacher_id = ? AND h.status = 'active'
        ORDER BY h.created_at DESC
      `, [teacher.id]);
      
      console.log(`   📚 Teacher's homework count: ${teacherHomework.length}`);
      console.log(`   📋 Recent assignments:`);
      teacherHomework.slice(0, 5).forEach((hw, index) => {
        console.log(`      ${index + 1}. "${hw.title}" (${hw.assignment_type || 'class'})`);
      });
    }
    
    // Test 3: Check for issues
    console.log('\n🔍 Checking for potential issues:');
    
    const nullClassHomework = await query(`
      SELECT COUNT(*) as count
      FROM homework 
      WHERE class_id IS NULL AND status = 'active'
    `);
    
    if (nullClassHomework[0].count > 0) {
      console.log(`   ❌ Found ${nullClassHomework[0].count} homework with null class_id`);
    } else {
      console.log('   ✅ No homework with null class_id');
    }
    
    const activeHomework = await query(`
      SELECT COUNT(*) as count
      FROM homework 
      WHERE status = 'active'
    `);
    
    console.log(`   📊 Total active homework: ${activeHomework[0].count}`);
    
    console.log('\n🎉 Homework system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testHomeworkSimple()
  .then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
