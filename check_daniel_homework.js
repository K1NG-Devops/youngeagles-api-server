import { query, initDatabase } from './src/db.js';

async function checkDanielHomework() {
  try {
    console.log('🔍 Checking Daniel Baker\'s homework in database...\n');
    
    await initDatabase();
    
    // Step 1: Find Daniel Baker
    console.log('👦 Looking for Daniel Baker...');
    const danielRecords = await query(`
      SELECT id, first_name, last_name, className, parent_id, age 
      FROM children 
      WHERE first_name LIKE '%Daniel%' AND last_name LIKE '%Baker%'
    `);
    
    if (danielRecords.length === 0) {
      console.log('❌ Daniel Baker not found in children table');
      return;
    }
    
    console.log('✅ Found Daniel Baker:');
    danielRecords.forEach(child => {
      console.log(`  - ID: ${child.id}, Name: ${child.first_name} ${child.last_name}, Class: ${child.className}, Parent: ${child.parent_id}`);
    });
    
    const daniel = danielRecords[0];
    
    // Step 2: Check homework table
    console.log('\n📚 Checking homework table...');
    
    try {
      const homeworkRecords = await query(`
        SELECT * FROM homework 
        WHERE class_id = (SELECT id FROM classes WHERE name = ?) 
           OR title LIKE '%Daniel%' 
           OR description LIKE '%Daniel%'
      `, [daniel.className]);
      
      console.log(`Found ${homeworkRecords.length} homework records in 'homework' table for Daniel's class or mentioning Daniel`);
      homeworkRecords.forEach(hw => {
        console.log(`  - ID: ${hw.id}, Title: "${hw.title}", Class: ${hw.class_id}, Teacher: ${hw.teacher_id}, Status: ${hw.status}`);
      });
    } catch (homeworkError) {
      console.log('⚠️ Error with homework table:', homeworkError.message);
    }
    
    // Step 3: Check homeworks table (legacy)
    console.log('\n📋 Checking homeworks table (legacy)...');
    
    try {
      const homeworksRecords = await query(`
        SELECT * FROM homeworks 
        WHERE class_name = ? 
           OR title LIKE '%Daniel%' 
           OR instructions LIKE '%Daniel%'
      `, [daniel.className]);
      
      console.log(`Found ${homeworksRecords.length} homework records in 'homeworks' table for Daniel's class or mentioning Daniel`);
      homeworksRecords.forEach(hw => {
        console.log(`  - ID: ${hw.id}, Title: "${hw.title}", Class: ${hw.class_name}, Teacher: ${hw.uploaded_by_teacher_id}, Status: ${hw.status}`);
      });
    } catch (homeworksError) {
      console.log('⚠️ Error with homeworks table:', homeworksError.message);
    }
    
    // Step 4: Check for individual assignments
    console.log('\n👤 Checking for individual assignments...');
    
    try {
      const individualAssignments = await query(`
        SELECT h.*, 'homework' as source_table
        FROM homework h
        JOIN homework_individual_assignments hia ON h.id = hia.homework_id
        WHERE hia.child_id = ?
        
        UNION ALL
        
        SELECT h.*, 'homeworks' as source_table
        FROM homeworks h
        WHERE h.title LIKE '%Daniel%' OR h.instructions LIKE '%Daniel%'
      `, [daniel.id]);
      
      console.log(`Found ${individualAssignments.length} individual assignments for Daniel`);
      individualAssignments.forEach(hw => {
        console.log(`  - ID: ${hw.id}, Title: "${hw.title}", Source: ${hw.source_table}, Status: ${hw.status || 'N/A'}`);
      });
    } catch (individualError) {
      console.log('⚠️ Error checking individual assignments:', individualError.message);
    }
    
    // Step 5: Check homework submissions
    console.log('\n📝 Checking homework submissions...');
    
    try {
      const submissions = await query(`
        SELECT hs.*, h.title as homework_title
        FROM homework_submissions hs
        LEFT JOIN homework h ON hs.homework_id = h.id
        LEFT JOIN homeworks hw ON hs.homework_id = hw.id
        WHERE hs.child_id = ?
      `, [daniel.id]);
      
      console.log(`Found ${submissions.length} homework submissions for Daniel`);
      submissions.forEach(sub => {
        console.log(`  - Submission ID: ${sub.id}, Homework: "${sub.homework_title || 'Unknown'}", Status: ${sub.status}, Submitted: ${sub.submitted_at}`);
      });
    } catch (submissionError) {
      console.log('⚠️ Error checking submissions:', submissionError.message);
    }
    
    // Step 6: Check parent's perspective
    console.log('\n👨‍👩‍👧‍👦 Checking parent\'s homework view...');
    
    try {
      const parentHomework = await query(`
        SELECT 
          h.*,
          c.first_name as child_name,
          c.last_name as child_last_name,
          cl.name as class_name,
          s.name as teacher_name,
          s.email as teacher_email,
          CASE 
            WHEN h.due_date < NOW() AND (hs.id IS NULL) THEN 'overdue'
            WHEN hs.id IS NOT NULL THEN 'submitted'
            ELSE 'pending'
          END as status,
          hs.submitted_at,
          hs.grade,
          hs.feedback as teacher_feedback
        FROM children c
        JOIN classes cl ON cl.id = c.class_id
        JOIN homework h ON h.class_id = cl.id
        LEFT JOIN staff s ON s.id = h.teacher_id
        LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.child_id = c.id
        WHERE c.parent_id = ? AND c.id = ?
        ORDER BY h.due_date DESC
      `, [daniel.parent_id, daniel.id]);
      
      console.log(`Found ${parentHomework.length} homework assignments for Daniel from parent's perspective`);
      parentHomework.forEach(hw => {
        console.log(`  - ID: ${hw.id}, Title: "${hw.title}", Class: ${hw.class_name}, Teacher: ${hw.teacher_name}, Status: ${hw.status}`);
      });
    } catch (parentError) {
      console.log('⚠️ Error checking parent view:', parentError.message);
      
      // Try alternative query
      console.log('🔄 Trying alternative parent query...');
      try {
        const altParentHomework = await query(`
          SELECT 
            h.*,
            c.first_name as child_name,
            c.last_name as child_last_name,
            h.class_name,
            s.name as teacher_name,
            s.email as teacher_email,
            CASE 
              WHEN hs.id IS NOT NULL THEN 'submitted'
              ELSE 'pending'
            END as status
          FROM children c
          LEFT JOIN homeworks h ON h.class_name = c.className
          LEFT JOIN staff s ON h.uploaded_by_teacher_id = s.id
          LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.child_id = c.id
          WHERE c.parent_id = ? AND c.id = ? AND h.id IS NOT NULL
          ORDER BY h.due_date DESC
        `, [daniel.parent_id, daniel.id]);
        
        console.log(`Found ${altParentHomework.length} homework assignments using alternative query`);
        altParentHomework.forEach(hw => {
          console.log(`  - ID: ${hw.id}, Title: "${hw.title}", Class: ${hw.class_name}, Teacher: ${hw.teacher_name}, Status: ${hw.status}`);
        });
      } catch (altError) {
        console.log('⚠️ Alternative query also failed:', altError.message);
      }
    }
    
    // Step 7: Summary
    console.log('\n📊 Summary:');
    console.log(`✅ Daniel Baker found (ID: ${daniel.id}, Class: ${daniel.className})`);
    console.log('📚 Homework table status checked');
    console.log('📋 Legacy homeworks table status checked');
    console.log('👤 Individual assignments checked');
    console.log('📝 Submissions checked');
    console.log('👨‍👩‍👧‍👦 Parent view checked');
    
  } catch (error) {
    console.error('❌ Error checking Daniel\'s homework:', error);
  }
}

// Run the check
checkDanielHomework()
  .then(() => {
    console.log('\n✅ Daniel Baker homework check completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
