import { query, initDatabase } from './src/db.js';

async function checkHomework29Status() {
  try {
    console.log('🔍 Checking homework ID 29 submissions and parent view...\n');
    
    await initDatabase();
    
    // Step 1: Check homework details
    console.log('📚 Homework 29 details:');
    const [homework] = await query(`
      SELECT id, title, content_type, assignment_type, status, class_id, due_date
      FROM homework 
      WHERE id = 29
    `);
    
    if (homework) {
      console.log(`  ✅ Title: "${homework.title}"`);
      console.log(`  ✅ Content Type: ${homework.content_type}`);
      console.log(`  ✅ Assignment Type: ${homework.assignment_type}`);
      console.log(`  ✅ Status: ${homework.status}`);
      console.log(`  ✅ Class ID: ${homework.class_id}`);
      console.log(`  ✅ Due Date: ${homework.due_date}`);
    } else {
      console.log('  ❌ Homework 29 not found');
      return;
    }
    
    // Step 2: Check submissions for homework 29
    console.log('\n📝 Checking submissions for homework 29:');
    const submissions = await query(`
      SELECT 
        hs.id,
        hs.homework_id,
        hs.child_id,
        hs.status,
        hs.submission_type,
        hs.score,
        hs.grade,
        hs.submitted_at,
        c.first_name,
        c.last_name,
        c.parent_id
      FROM homework_submissions hs
      JOIN children c ON hs.child_id = c.id
      WHERE hs.homework_id = 29
      ORDER BY hs.submitted_at DESC
    `);
    
    console.log(`  Found ${submissions.length} submissions for homework 29:`);
    if (submissions.length > 0) {
      submissions.forEach((sub, index) => {
        console.log(`    ${index + 1}. ${sub.first_name} ${sub.last_name} (Child ID: ${sub.child_id}, Parent ID: ${sub.parent_id})`);
        console.log(`       Status: ${sub.status}, Type: ${sub.submission_type}, Score: ${sub.score || 'N/A'}`);
        console.log(`       Submitted: ${sub.submitted_at}`);
        console.log('');
      });
    }
    
    // Step 3: Check children assigned to class 2 (Panda class)
    console.log('👶 Children in class 2 (Panda):');
    const classChildren = await query(`
      SELECT 
        c.id,
        c.first_name,
        c.last_name,
        c.parent_id,
        c.class_id,
        u.name as parent_name,
        u.email as parent_email
      FROM children c
      JOIN users u ON c.parent_id = u.id
      WHERE c.class_id = 2
      ORDER BY c.first_name
    `);
    
    console.log(`  Found ${classChildren.length} children in class 2:`);
    classChildren.forEach((child, index) => {
      console.log(`    ${index + 1}. ${child.first_name} ${child.last_name} (ID: ${child.id}, Parent: ${child.parent_name})`);
    });
    
    // Step 4: Test the parent API endpoint for each parent
    console.log('\n🧪 Testing parent homework view for each parent:');
    
    for (const child of classChildren) {
      console.log(`\n  Testing parent ${child.parent_name} (ID: ${child.parent_id}):`);
      
      const parentHomework = await query(`
        SELECT DISTINCT
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
          hs.feedback as teacher_feedback,
          h.content_type
        FROM children c
        JOIN classes cl ON cl.id = c.class_id
        JOIN homework h ON (
          (h.class_id = cl.id AND h.assignment_type = 'class') OR
          (h.assignment_type = 'individual' AND EXISTS (
            SELECT 1 FROM homework_individual_assignments hia 
            WHERE hia.homework_id = h.id AND hia.child_id = c.id
          ))
        )
        LEFT JOIN staff s ON s.id = h.teacher_id
        LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.child_id = c.id
        WHERE c.parent_id = ? AND h.status = 'active' AND h.id = 29
      `, [child.parent_id]);
      
      if (parentHomework.length > 0) {
        parentHomework.forEach(hw => {
          console.log(`    ✅ Homework visible: "${hw.title}"`);
          console.log(`       Child: ${hw.child_name} ${hw.child_last_name}`);
          console.log(`       Status: ${hw.status}`);
          console.log(`       Content Type: ${hw.content_type}`);
          if (hw.submitted_at) {
            console.log(`       Submitted: ${hw.submitted_at}`);
          }
          if (hw.grade) {
            console.log(`       Grade: ${hw.grade}`);
          }
        });
      } else {
        console.log(`    ❌ Homework 29 NOT visible for parent ${child.parent_name}`);
      }
    }
    
    // Step 5: Quick status summary
    console.log('\n📊 SUMMARY:');
    console.log(`  📚 Homework 29: "${homework.title}" (${homework.content_type})`);
    console.log(`  👶 Class has ${classChildren.length} children`);
    console.log(`  📝 Found ${submissions.length} submissions`);
    
    if (submissions.length === 0) {
      console.log('\n💡 RECOMMENDATION: No submissions found.');
      console.log('     - If homework was completed, the submission may not have been saved properly');
      console.log('     - Interactive homework should auto-submit when completed');
      console.log('     - Check if the completion actually triggered the submit API call');
    } else {
      console.log('\n✅ GOOD: Submissions exist, so the pending count should update automatically');
    }
    
  } catch (error) {
    console.error('❌ Error checking homework 29:', error);
  }
}

// Run the check
checkHomework29Status()
  .then(() => {
    console.log('\n✅ Homework 29 status check completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
