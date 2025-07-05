import { query, initDatabase } from './src/db.js';

async function fixBrokenHomework() {
  try {
    console.log('🔧 Fixing homework with null class_id...\n');
    
    await initDatabase();
    
    // Find homework with null class_id
    const brokenHomework = await query(`
      SELECT * FROM homework 
      WHERE class_id IS NULL 
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${brokenHomework.length} homework assignments with null class_id:`);
    
    for (const hw of brokenHomework) {
      console.log(`\n🔍 Fixing homework ID ${hw.id}: "${hw.title}"`);
      
      // Check if this homework has individual assignments
      try {
        const individualAssignments = await query(`
          SELECT hia.*, c.class_id, c.className 
          FROM homework_individual_assignments hia
          JOIN children c ON c.id = hia.child_id
          WHERE hia.homework_id = ?
          LIMIT 1
        `, [hw.id]);
        
        if (individualAssignments.length > 0) {
          const classId = individualAssignments[0].class_id;
          const className = individualAssignments[0].className;
          
          console.log(`   📝 Found individual assignment for class_id ${classId} (${className})`);
          
          // Update the homework with the correct class_id
          await query(`
            UPDATE homework 
            SET class_id = ? 
            WHERE id = ?
          `, [classId, hw.id]);
          
          console.log(`   ✅ Updated homework ${hw.id} with class_id ${classId}`);
        } else {
          // For homework without individual assignments, try to guess based on teacher
          console.log(`   ⚠️ No individual assignments found, trying to assign to teacher's main class...`);
          
          // Get the teacher's classes
          const teacherClasses = await query(`
            SELECT cl.id, cl.name 
            FROM classes cl
            JOIN staff s ON s.className = cl.name
            WHERE s.id = ?
            LIMIT 1
          `, [hw.teacher_id]);
          
          if (teacherClasses.length > 0) {
            const classId = teacherClasses[0].id;
            const className = teacherClasses[0].name;
            
            await query(`
              UPDATE homework 
              SET class_id = ? 
              WHERE id = ?
            `, [classId, hw.id]);
            
            console.log(`   ✅ Assigned homework ${hw.id} to teacher's class ${classId} (${className})`);
          } else {
            console.log(`   ❌ Could not determine class for homework ${hw.id}`);
          }
        }
      } catch (error) {
        console.error(`   ❌ Error fixing homework ${hw.id}:`, error.message);
      }
    }
    
    // Verify the fix
    console.log('\n🔍 Verification after fix:');
    const danielHomework = await query(`
      SELECT COUNT(*) as count
      FROM homework h
      JOIN children c ON c.class_id = h.class_id
      WHERE c.id = 15
    `);
    console.log(`📚 Daniel Baker now has ${danielHomework[0].count} homework assignments`);
    
    const remainingBroken = await query(`
      SELECT COUNT(*) as count 
      FROM homework 
      WHERE class_id IS NULL
    `);
    console.log(`🔧 Remaining homework with null class_id: ${remainingBroken[0].count}`);
    
  } catch (error) {
    console.error('❌ Error fixing homework:', error);
  }
}

// Run the fix
fixBrokenHomework()
  .then(() => {
    console.log('\n✅ Homework fix completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });
