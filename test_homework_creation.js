import { query, initDatabase } from './src/db.js';

async function testHomeworkCreation() {
  try {
    console.log('🧪 Testing homework creation and refresh mechanism...\n');
    
    await initDatabase();
    
    // Step 1: Get current homework count
    console.log('📊 Current state:');
    const currentHomework = await query(`
      SELECT COUNT(*) as count
      FROM homework h
      JOIN children c ON c.class_id = h.class_id
      WHERE c.id = 15
    `);
    console.log(`   Daniel Baker has ${currentHomework[0].count} homework assignments`);
    
    // Step 2: Create a new homework assignment using API structure
    console.log('\n📝 Creating new homework assignment...');
    
    const newHomework = {
      title: 'Color Recognition and Patterns (CAPS Art)',
      description: 'Learn primary colors and simple patterns through hands-on creative activities. Students will identify colors, create patterns, and express creativity.',
      instructions: `Dear Daniel,

Today you will explore the wonderful world of colors and patterns!

Activities to complete:
1. **Color Hunt**: Find 3 red objects, 3 blue objects, and 3 yellow objects in your home
2. **Pattern Making**: 
   - Create a pattern with colored blocks: red-blue-red-blue-red-?
   - Make your own pattern with toys or crayons
3. **Color Mixing**: If you have paints, try mixing red + yellow = ?
4. **Creative Drawing**: Draw a rainbow using all the colors you know

**Learning Goals**:
- Recognize primary colors (red, blue, yellow)
- Understand simple patterns
- Develop fine motor skills through art
- Express creativity and imagination

**Materials**: Crayons, colored paper, toys, household objects

**Parent Guide**: Help Daniel identify colors around the house and encourage him to explain his patterns.

Have a colorful day of learning!`,
      subject: 'Art & Creativity',
      grade: 'Grade R',
      difficulty: 'easy',
      estimated_duration: 25,
      due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // 5 days from now
      teacher_id: 16, // Dimakatso Mogashoa
      class_id: 2,    // Panda class
      status: 'active'
    };
    
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
      newHomework.title,
      newHomework.description,
      newHomework.instructions,
      newHomework.teacher_id,
      newHomework.class_id,
      newHomework.due_date,
      newHomework.subject,
      newHomework.grade,
      newHomework.difficulty,
      newHomework.estimated_duration,
      newHomework.status
    ]);
    
    const homeworkId = result.insertId;
    console.log(`✅ Homework created with ID: ${homeworkId}`);
    
    // Step 3: Verify the homework was created
    console.log('\n🔍 Verification:');
    const verifyHomework = await query(`
      SELECT COUNT(*) as count
      FROM homework h
      JOIN children c ON c.class_id = h.class_id
      WHERE c.id = 15
    `);
    console.log(`   Daniel Baker now has ${verifyHomework[0].count} homework assignments`);
    
    // Step 4: Show all homework for Daniel
    console.log('\n📋 All homework for Daniel Baker:');
    const allHomework = await query(`
      SELECT 
        h.id,
        h.title,
        h.subject,
        h.due_date,
        s.name as teacher_name,
        h.status,
        h.created_at
      FROM homework h
      JOIN children c ON c.class_id = h.class_id
      LEFT JOIN staff s ON s.id = h.teacher_id
      WHERE c.id = 15
      ORDER BY h.created_at DESC
    `);
    
    allHomework.forEach((hw, index) => {
      console.log(`   ${index + 1}. "${hw.title}"`);
      console.log(`      Subject: ${hw.subject || 'Not specified'}`);
      console.log(`      Teacher: ${hw.teacher_name}`);
      console.log(`      Due: ${new Date(hw.due_date).toLocaleDateString()}`);
      console.log(`      Status: ${hw.status}`);
      console.log(`      Created: ${new Date(hw.created_at).toLocaleDateString()}`);
      console.log('');
    });
    
    // Step 5: Test teacher homework count
    console.log('👩‍🏫 Teacher homework count:');
    const teacherHomework = await query(`
      SELECT COUNT(*) as count
      FROM homework 
      WHERE teacher_id = 16
    `);
    console.log(`   Teacher Dimakatso has ${teacherHomework[0].count} homework assignments`);
    
    console.log('\n🎉 Test completed successfully!');
    console.log('\n📱 Now test in the app:');
    console.log('   1. Check teacher dashboard - should show 3 assignments');
    console.log('   2. Check parent dashboard - Daniel should have 3 homework');
    console.log('   3. Try creating homework via "Create Homework" button');
    console.log('   4. Verify the counts update correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testHomeworkCreation()
  .then(() => {
    console.log('\n✅ Test script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });
