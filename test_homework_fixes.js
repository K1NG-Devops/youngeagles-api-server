import { query, initDatabase } from './src/db.js';

async function testHomeworkFixes() {
  try {
    console.log('🧪 Testing homework creation and visibility fixes...\n');
    
    await initDatabase();
    
    // Step 1: Check current state
    console.log('📊 Current homework state:');
    const currentHomework = await query(`
      SELECT 
        h.id, 
        h.title, 
        h.assignment_type, 
        h.class_id, 
        h.teacher_id,
        h.status,
        cl.name as class_name,
        s.name as teacher_name
      FROM homework h
      LEFT JOIN classes cl ON cl.id = h.class_id
      LEFT JOIN staff s ON s.id = h.teacher_id
      WHERE h.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      ORDER BY h.created_at DESC
      LIMIT 10
    `);
    
    console.log(`   Found ${currentHomework.length} recent homework assignments:`);
    currentHomework.forEach((hw, index) => {
      console.log(`   ${index + 1}. ID: ${hw.id} - "${hw.title}"`);
      console.log(`      Type: ${hw.assignment_type || 'class'}, Class: ${hw.class_name || 'NULL'}, Teacher: ${hw.teacher_name}`);
      console.log(`      Status: ${hw.status}, Class ID: ${hw.class_id || 'NULL'}`);
      console.log('');
    });
    
    // Step 2: Check homework with null class_id
    console.log('🔍 Checking homework with null class_id:');
    const nullClassHomework = await query(`
      SELECT id, title, assignment_type, class_id, teacher_id
      FROM homework 
      WHERE class_id IS NULL
      ORDER BY created_at DESC
    `);
    
    if (nullClassHomework.length > 0) {
      console.log(`   ❌ Found ${nullClassHomework.length} homework with null class_id:`);
      nullClassHomework.forEach(hw => {
        console.log(`      ID: ${hw.id} - "${hw.title}" (Teacher: ${hw.teacher_id})`);
      });
      
      // Fix null class_id homework by assigning to teacher's class
      console.log('\n🔧 Fixing null class_id homework...');
      for (const hw of nullClassHomework) {
        const [teacher] = await query(
          'SELECT id, className FROM staff WHERE id = ? AND role = ?',
          [hw.teacher_id, 'teacher']
        );
        
        if (teacher && teacher.className) {
          const [teacherClass] = await query(
            'SELECT id FROM classes WHERE name = ?',
            [teacher.className]
          );
          
          if (teacherClass) {
            await query(
              'UPDATE homework SET class_id = ? WHERE id = ?',
              [teacherClass.id, hw.id]
            );
            console.log(`   ✅ Fixed homework ${hw.id}: assigned to class ${teacher.className} (ID: ${teacherClass.id})`);
          }
        }
      }
    } else {
      console.log('   ✅ No homework with null class_id found');
    }
    
    // Step 3: Test parent homework visibility for Daniel Baker
    console.log('\n👪 Testing parent homework visibility for Daniel Baker:');
    const [daniel] = await query(`
      SELECT id, first_name, last_name, parent_id, class_id
      FROM children 
      WHERE first_name = 'Daniel' AND last_name = 'Baker'
    `);
    
    if (daniel) {
      console.log(`   Found Daniel Baker: ID ${daniel.id}, Parent ID: ${daniel.parent_id}, Class ID: ${daniel.class_id}`);
      
      // Check class homework
      const classHomework = await query(`
        SELECT 
          h.id, h.title, h.assignment_type, h.class_id, h.teacher_id,
          cl.name as class_name,
          s.name as teacher_name
        FROM homework h
        LEFT JOIN classes cl ON cl.id = h.class_id
        LEFT JOIN staff s ON s.id = h.teacher_id
        WHERE h.class_id = ? AND h.status = 'active'
        ORDER BY h.created_at DESC
      `, [daniel.class_id]);
      
      console.log(`   📚 Class homework for Daniel's class: ${classHomework.length} assignments`);
      
      // Check individual homework
      const individualHomework = await query(`
        SELECT 
          h.id, h.title, h.assignment_type, h.class_id, h.teacher_id,
          hia.status as assignment_status,
          cl.name as class_name,
          s.name as teacher_name
        FROM homework h
        JOIN homework_individual_assignments hia ON hia.homework_id = h.id
        LEFT JOIN classes cl ON cl.id = h.class_id
        LEFT JOIN staff s ON s.id = h.teacher_id
        WHERE hia.child_id = ? AND h.status = 'active'
        ORDER BY h.created_at DESC
      `, [daniel.id]);
      
      console.log(`   👤 Individual homework for Daniel: ${individualHomework.length} assignments`);
      
      // Test parent homework query
      const parentHomework = await query(`
        SELECT DISTINCT
          h.id,
          h.title,
          h.assignment_type,
          c.first_name as child_name,
          c.last_name as child_last_name,
          cl.name as class_name,
          s.name as teacher_name
        FROM children c
        JOIN classes cl ON cl.id = c.class_id
        JOIN homework h ON (
          (h.class_id = cl.id AND (h.assignment_type = 'class' OR h.assignment_type IS NULL)) OR
          (h.assignment_type = 'individual' AND EXISTS (
            SELECT 1 FROM homework_individual_assignments hia 
            WHERE hia.homework_id = h.id AND hia.child_id = c.id
          ))
        )
        LEFT JOIN staff s ON s.id = h.teacher_id
        WHERE c.parent_id = ? AND h.status = 'active'
        ORDER BY h.created_at DESC
      `, [daniel.parent_id]);
      
      console.log(`   📋 Total homework visible to parent: ${parentHomework.length} assignments`);
      parentHomework.forEach((hw, index) => {
        console.log(`      ${index + 1}. "${hw.title}" (${hw.assignment_type || 'class'}) - ${hw.teacher_name}`);
      });
    } else {
      console.log('   ❌ Daniel Baker not found');
    }
    
    // Step 4: Test teacher homework count
    console.log('\n👩‍🏫 Testing teacher homework visibility:');
    const [dimakatso] = await query(`
      SELECT id, name, className 
      FROM staff 
      WHERE name LIKE '%Dimakatso%' AND role = 'teacher'
    `);
    
    if (dimakatso) {
      console.log(`   Found teacher: ${dimakatso.name} (Class: ${dimakatso.className})`);
      
      const teacherHomework = await query(`
        SELECT 
          h.id, 
          h.title, 
          h.assignment_type, 
          h.class_id,
          cl.name as class_name,
          CASE 
            WHEN h.assignment_type = 'individual' THEN (
              SELECT COUNT(*) FROM homework_individual_assignments hia WHERE hia.homework_id = h.id
            )
            ELSE (
              SELECT COUNT(*) FROM children c WHERE c.class_id = h.class_id
            )
          END as student_count
        FROM homework h
        LEFT JOIN classes cl ON cl.id = h.class_id
        WHERE h.teacher_id = ? AND h.status = 'active'
        ORDER BY h.created_at DESC
      `, [dimakatso.id]);
      
      console.log(`   📚 Teacher's homework assignments: ${teacherHomework.length} total`);
      teacherHomework.forEach((hw, index) => {
        console.log(`      ${index + 1}. "${hw.title}" (${hw.assignment_type || 'class'}) - ${hw.student_count} students`);
      });
    }
    
    console.log('\n🎉 Homework fixes test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testHomeworkFixes()
  .then(() => {
    console.log('\n✅ Test script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });
