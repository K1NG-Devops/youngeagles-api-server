import { query, initDatabase } from './src/db.js';

async function createHomeworkForDaniel() {
  try {
    console.log('📚 Creating new homework assignment for Daniel Baker from CAPS Library...\n');
    
    await initDatabase();
    
    // Step 1: Get Daniel Baker's information
    console.log('👦 Finding Daniel Baker...');
    const [daniel] = await query(`
      SELECT id, first_name, last_name, className, parent_id, age, class_id
      FROM children 
      WHERE first_name = 'Daniel' AND last_name = 'Baker'
    `);
    
    if (!daniel) {
      console.log('❌ Daniel Baker not found');
      return;
    }
    
    console.log(`✅ Found Daniel Baker: ID ${daniel.id}, Class: ${daniel.className}, Class ID: ${daniel.class_id}`);
    
    // Step 2: Get a teacher for the Panda class
    console.log('\n👩‍🏫 Finding teacher for Panda class...');
    const [teacher] = await query(`
      SELECT id, name, email
      FROM staff 
      WHERE className = 'Panda' AND role = 'teacher'
      LIMIT 1
    `);
    
    if (!teacher) {
      console.log('❌ No teacher found for Panda class');
      return;
    }
    
    console.log(`✅ Found teacher: ${teacher.name} (ID: ${teacher.id})`);
    
    // Step 3: CAPS Library homework assignment
    const capsHomework = {
      title: "Basic Addition 1-5 (CAPS Mathematics)",
      description: "Introduction to addition concepts using visual aids and manipulatives. Students will learn to add numbers 1-5 using concrete objects and pictures.",
      instructions: `Dear Daniel,

Complete the following CAPS-aligned mathematics activities:

1. **Counting Practice**: Count objects from 1 to 5 using toys or household items
2. **Addition with Objects**: 
   - Use 2 blocks + 1 block = ? blocks
   - Use 3 crayons + 2 crayons = ? crayons
   - Use 1 apple + 4 apples = ? apples
3. **Drawing Activity**: Draw simple addition problems and solve them
4. **Number Recognition**: Practice writing numbers 1-5

**Learning Objectives**:
- Understand basic addition concepts
- Use concrete materials for mathematical thinking
- Develop number sense and counting skills

**Materials Needed**: Counting objects (blocks, crayons, toys), paper, pencils

**Parent Support**: Please help Daniel count objects and encourage verbal explanations of his thinking.

Have fun learning!`,
      subject: "Mathematics",
      grade: "Grade R",
      difficulty: "easy",
      estimated_duration: 30,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // 7 days from now
      teacher_id: teacher.id,
      class_id: daniel.class_id,
      status: 'active'
    };
    
    // Step 4: Create the homework assignment
    console.log('\n📝 Creating homework assignment...');
    console.log(`Title: "${capsHomework.title}"`);
    console.log(`Subject: ${capsHomework.subject}`);
    console.log(`Grade: ${capsHomework.grade}`);
    console.log(`Due Date: ${capsHomework.due_date}`);
    console.log(`Teacher: ${teacher.name}`);
    
    const result = await query(`
      INSERT INTO homework (
        title,
        description,
        instructions,
        teacher_id,
        class_id,
        due_date,
        subject,
        grade,
        difficulty,
        estimated_duration,
        status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      capsHomework.title,
      capsHomework.description,
      capsHomework.instructions,
      capsHomework.teacher_id,
      capsHomework.class_id,
      capsHomework.due_date,
      capsHomework.subject,
      capsHomework.grade,
      capsHomework.difficulty,
      capsHomework.estimated_duration,
      capsHomework.status
    ]);
    
    const homeworkId = result.insertId;
    console.log(`✅ Homework created successfully! ID: ${homeworkId}`);
    
    // Step 5: Create individual assignment entry (if table exists)
    console.log('\n👤 Creating individual assignment for Daniel...');
    try {
      await query(`
        INSERT INTO homework_individual_assignments (homework_id, child_id, status, assigned_at) 
        VALUES (?, ?, 'assigned', NOW())
      `, [homeworkId, daniel.id]);
      console.log('✅ Individual assignment created');
    } catch (individualError) {
      if (individualError.code === 'ER_NO_SUCH_TABLE') {
        console.log('ℹ️ Individual assignments table does not exist (this is normal)');
        console.log('ℹ️ Homework will be visible to all students in the Panda class');
      } else {
        console.log('⚠️ Error creating individual assignment:', individualError.message);
      }
    }
    
    // Step 6: Verify the homework was created
    console.log('\n🔍 Verifying homework creation...');
    const verification = await query(`
      SELECT 
        h.*,
        c.first_name as child_name,
        c.last_name as child_last_name,
        cl.name as class_name,
        s.name as teacher_name,
        s.email as teacher_email,
        'pending' as status
      FROM children c
      JOIN classes cl ON cl.id = c.class_id
      JOIN homework h ON h.class_id = cl.id
      LEFT JOIN staff s ON s.id = h.teacher_id
      WHERE c.id = ? AND h.id = ?
    `, [daniel.id, homeworkId]);
    
    if (verification.length > 0) {
      const hw = verification[0];
      console.log('✅ Homework verified in parent view:');
      console.log(`  - Title: "${hw.title}"`);
      console.log(`  - Class: ${hw.class_name}`);
      console.log(`  - Teacher: ${hw.teacher_name}`);
      console.log(`  - Due Date: ${hw.due_date}`);
      console.log(`  - Status: ${hw.status}`);
    }
    
    // Step 7: Check total homework count for Daniel
    console.log('\n📊 Checking total homework count for Daniel...');
    const totalHomework = await query(`
      SELECT COUNT(*) as count
      FROM children c
      JOIN classes cl ON cl.id = c.class_id
      JOIN homework h ON h.class_id = cl.id
      WHERE c.id = ?
    `, [daniel.id]);
    
    console.log(`📚 Daniel Baker now has ${totalHomework[0].count} homework assignments in total`);
    
    // Step 8: List all homework for Daniel
    console.log('\n📋 All homework assignments for Daniel Baker:');
    const allHomework = await query(`
      SELECT 
        h.id,
        h.title,
        h.subject,
        h.due_date,
        s.name as teacher_name,
        h.status,
        h.created_at
      FROM children c
      JOIN classes cl ON cl.id = c.class_id
      JOIN homework h ON h.class_id = cl.id
      LEFT JOIN staff s ON s.id = h.teacher_id
      WHERE c.id = ?
      ORDER BY h.created_at DESC
    `, [daniel.id]);
    
    allHomework.forEach((hw, index) => {
      console.log(`  ${index + 1}. ID: ${hw.id} - "${hw.title}"`);
      console.log(`     Subject: ${hw.subject}, Teacher: ${hw.teacher_name}`);
      console.log(`     Due: ${hw.due_date}, Status: ${hw.status}`);
      console.log(`     Created: ${hw.created_at}`);
      console.log('');
    });
    
    console.log('🎉 New CAPS Mathematics homework successfully created for Daniel Baker!');
    console.log('📱 You can now check the parent dashboard to see both homework assignments.');
    
  } catch (error) {
    console.error('❌ Error creating homework:', error);
  }
}

// Run the script
createHomeworkForDaniel()
  .then(() => {
    console.log('\n✅ Homework creation completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Homework creation failed:', error);
    process.exit(1);
  });
