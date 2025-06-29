import crypto from 'crypto';
import { query, execute } from './src/db.js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

// Use bcrypt for password hashing
function hashPassword(password) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

// Generate realistic demo data
const createMarketingDemoData = async () => {
  try {
    console.log('🎯 Creating Marketing Demo Data for YoungEagles Parent Dashboard...\n');
    
    // ========================================
    // 1. Create Demo Teachers
    // ========================================
    console.log('1️⃣ Creating demo teachers...');
    
    const teachers = [
      { name: 'Mrs. Sarah Johnson', email: 'sarah.johnson@youngeagles.org.za', className: 'Eagles' },
      { name: 'Mr. David Miller', email: 'david.miller@youngeagles.org.za', className: 'Hawks' },
      { name: 'Ms. Lisa Chen', email: 'lisa.chen@youngeagles.org.za', className: 'Falcons' },
      { name: 'Mrs. Emily Brown', email: 'emily.brown@youngeagles.org.za', className: 'Owls' }
    ];

    const teacherIds = {};
    
    for (const teacher of teachers) {
      const hashedPassword = hashPassword('Teacher@123');
      
      // Check if teacher exists
      const existing = await query(
        'SELECT id FROM staff WHERE email = ?',
        [teacher.email],
        'skydek_DB'
      );

      if (existing.length > 0) {
        teacherIds[teacher.className] = existing[0].id;
        console.log(`⚠️  Teacher ${teacher.name} already exists`);
      } else {
        const result = await execute(
          'INSERT INTO staff (name, email, password, role, className, is_verified) VALUES (?, ?, ?, ?, ?, TRUE)',
          [teacher.name, teacher.email, hashedPassword, 'teacher', teacher.className],
          'skydek_DB'
        );
        teacherIds[teacher.className] = result.insertId;
        console.log(`✅ Created teacher: ${teacher.name} (${teacher.className})`);
      }
    }

    // ========================================
    // 2. Create Demo Parents
    // ========================================
    console.log('\n2️⃣ Creating demo parents...');
    
    const parents = [
      { 
        name: 'Jessica Martinez', 
        email: 'jessica.martinez@email.com',
        address: '123 Maple Street, Johannesburg, 2000'
      },
      { 
        name: 'Michael Thompson', 
        email: 'michael.thompson@email.com',
        address: '456 Oak Avenue, Sandton, 2196'
      },
      { 
        name: 'Amanda Wilson', 
        email: 'amanda.wilson@email.com',
        address: '789 Pine Road, Randburg, 2194'
      },
      { 
        name: 'Robert Garcia', 
        email: 'robert.garcia@email.com',
        address: '321 Cedar Lane, Rosebank, 2196'
      }
    ];

    const parentIds = {};
    
    for (const parent of parents) {
      const hashedPassword = hashPassword('Parent@123');
      
      // Check if parent exists
      const existing = await query(
        'SELECT id FROM users WHERE email = ?',
        [parent.email],
        'skydek_DB'
      );

      if (existing.length > 0) {
        parentIds[parent.email] = existing[0].id;
        console.log(`⚠️  Parent ${parent.name} already exists`);
      } else {
        const result = await execute(
          'INSERT INTO users (name, email, password, role, address) VALUES (?, ?, ?, ?, ?)',
          [parent.name, parent.email, hashedPassword, 'parent', parent.address],
          'skydek_DB'
        );
        parentIds[parent.email] = result.insertId;
        console.log(`✅ Created parent: ${parent.name}`);
      }
    }

    // ========================================
    // 3. Create Demo Children with Diverse Profiles
    // ========================================
    console.log('\n3️⃣ Creating demo children...');
    
    const children = [
      // Jessica Martinez's children
      { 
        name: 'Sofia Martinez', 
        age: 5, 
        className: 'Eagles', 
        parentEmail: 'jessica.martinez@email.com',
        interests: 'art, reading',
        learning_style: 'visual'
      },
      { 
        name: 'Diego Martinez', 
        age: 4, 
        className: 'Hawks', 
        parentEmail: 'jessica.martinez@email.com',
        interests: 'sports, building blocks',
        learning_style: 'kinesthetic'
      },
      
      // Michael Thompson's children
      { 
        name: 'Emma Thompson', 
        age: 6, 
        className: 'Falcons', 
        parentEmail: 'michael.thompson@email.com',
        interests: 'music, science',
        learning_style: 'auditory'
      },
      { 
        name: 'Noah Thompson', 
        age: 5, 
        className: 'Eagles', 
        parentEmail: 'michael.thompson@email.com',
        interests: 'puzzles, nature',
        learning_style: 'logical'
      },
      
      // Amanda Wilson's children
      { 
        name: 'Ava Wilson', 
        age: 4, 
        className: 'Owls', 
        parentEmail: 'amanda.wilson@email.com',
        interests: 'dancing, storytelling',
        learning_style: 'social'
      },
      
      // Robert Garcia's children
      { 
        name: 'Lucas Garcia', 
        age: 5, 
        className: 'Hawks', 
        parentEmail: 'robert.garcia@email.com',
        interests: 'mathematics, cooking',
        learning_style: 'logical'
      },
      { 
        name: 'Isabella Garcia', 
        age: 6, 
        className: 'Falcons', 
        parentEmail: 'robert.garcia@email.com',
        interests: 'languages, art',
        learning_style: 'visual'
      }
    ];

    const childIds = {};
    
    for (const child of children) {
      // Check if child exists
      const existing = await query(
        'SELECT id FROM children WHERE name = ? AND parent_id = ?',
        [child.name, parentIds[child.parentEmail]],
        'skydek_DB'
      );

      if (existing.length > 0) {
        childIds[child.name] = existing[0].id;
        console.log(`⚠️  Child ${child.name} already exists`);
      } else {
        const profileData = {
          interests: child.interests,
          learning_style: child.learning_style
        };
        
        const result = await execute(
          'INSERT INTO children (name, age, className, parent_id, profile_data) VALUES (?, ?, ?, ?, ?)',
          [child.name, child.age, child.className, parentIds[child.parentEmail], JSON.stringify(profileData)],
          'skydek_DB'
        );
        childIds[child.name] = result.insertId;
        console.log(`✅ Created child: ${child.name} (${child.className}, Parent: ${child.parentEmail})`);
      }
    }

    // ========================================
    // 4. Create Realistic Homework Assignments
    // ========================================
    console.log('\n4️⃣ Creating homework assignments...');
    
    const homeworkAssignments = [
      // Eagles Class (Mrs. Sarah Johnson)
      {
        title: 'Colors and Shapes Recognition',
        description: 'Identify and color different shapes. Circle the red objects and draw a triangle.',
        teacherClass: 'Eagles',
        status: 'active',
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        points: 10
      },
      {
        title: 'Number Counting 1-20',
        description: 'Practice counting from 1 to 20. Write the numbers and draw corresponding objects.',
        teacherClass: 'Eagles',
        status: 'active',
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        points: 15
      },
      {
        title: 'My Family Tree',
        description: 'Draw your family members and write their names. Tell us about each person.',
        teacherClass: 'Eagles',
        status: 'completed',
        due_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        points: 20
      },
      
      // Hawks Class (Mr. David Miller)
      {
        title: 'Letter Tracing A-F',
        description: 'Practice writing uppercase and lowercase letters A through F. Include pictures for each letter.',
        teacherClass: 'Hawks',
        status: 'active',
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        points: 12
      },
      {
        title: 'Weather Chart',
        description: 'Observe and record the weather for one week. Draw pictures of sunny, cloudy, and rainy days.',
        teacherClass: 'Hawks',
        status: 'active',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        points: 18
      },
      
      // Falcons Class (Ms. Lisa Chen)
      {
        title: 'Simple Addition Practice',
        description: 'Solve addition problems using numbers 1-10. Use objects or drawings to help you count.',
        teacherClass: 'Falcons',
        status: 'active',
        due_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
        points: 25
      },
      {
        title: 'Story Retelling',
        description: 'Read a favorite story and draw 4 pictures showing what happened. Write one sentence for each picture.',
        teacherClass: 'Falcons',
        status: 'completed',
        due_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        points: 20
      },
      
      // Owls Class (Mrs. Emily Brown)
      {
        title: 'Animal Habitats',
        description: 'Match animals to their homes. Draw where different animals live and explain why.',
        teacherClass: 'Owls',
        status: 'active',
        due_date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
        points: 15
      }
    ];

    const homeworkIds = {};
    
    for (const homework of homeworkAssignments) {
      // Check if homework exists
      const existing = await query(
        'SELECT id FROM homework WHERE title = ? AND teacher_id = ?',
        [homework.title, teacherIds[homework.teacherClass]],
        'skydek_DB'
      );

      if (existing.length > 0) {
        homeworkIds[homework.title] = existing[0].id;
        console.log(`⚠️  Homework "${homework.title}" already exists`);
      } else {
        const result = await execute(
          'INSERT INTO homework (title, description, teacher_id, status, due_date, points) VALUES (?, ?, ?, ?, ?, ?)',
          [homework.title, homework.description, teacherIds[homework.teacherClass], homework.status, homework.due_date, homework.points],
          'skydek_DB'
        );
        homeworkIds[homework.title] = result.insertId;
        console.log(`✅ Created homework: "${homework.title}" (${homework.teacherClass})`);
      }
    }

    // ========================================
    // 5. Create Homework Submissions with Realistic Grades
    // ========================================
    console.log('\n5️⃣ Creating homework submissions...');
    
    const submissions = [
      // Sofia Martinez submissions (Eagles class)
      { childName: 'Sofia Martinez', homeworkTitle: 'My Family Tree', status: 'graded', grade: 18, feedback: 'Excellent work! Your family tree is very detailed and creative.' },
      { childName: 'Sofia Martinez', homeworkTitle: 'Colors and Shapes Recognition', status: 'pending', grade: null, feedback: null },
      
      // Diego Martinez submissions (Hawks class)
      { childName: 'Diego Martinez', homeworkTitle: 'Letter Tracing A-F', status: 'pending', grade: null, feedback: null },
      { childName: 'Diego Martinez', homeworkTitle: 'Weather Chart', status: 'pending', grade: null, feedback: null },
      
      // Emma Thompson submissions (Falcons class)
      { childName: 'Emma Thompson', homeworkTitle: 'Story Retelling', status: 'graded', grade: 19, feedback: 'Great storytelling! Your pictures clearly show the story sequence.' },
      { childName: 'Emma Thompson', homeworkTitle: 'Simple Addition Practice', status: 'pending', grade: null, feedback: null },
      
      // Noah Thompson submissions (Eagles class)
      { childName: 'Noah Thompson', homeworkTitle: 'My Family Tree', status: 'graded', grade: 16, feedback: 'Good effort! Try to add more details about each family member next time.' },
      { childName: 'Noah Thompson', homeworkTitle: 'Number Counting 1-20', status: 'pending', grade: null, feedback: null },
      
      // Ava Wilson submissions (Owls class)
      { childName: 'Ava Wilson', homeworkTitle: 'Animal Habitats', status: 'pending', grade: null, feedback: null },
      
      // Lucas Garcia submissions (Hawks class)
      { childName: 'Lucas Garcia', homeworkTitle: 'Letter Tracing A-F', status: 'pending', grade: null, feedback: null },
      
      // Isabella Garcia submissions (Falcons class)
      { childName: 'Isabella Garcia', homeworkTitle: 'Story Retelling', status: 'graded', grade: 20, feedback: 'Perfect! Your story was engaging and your drawings were beautiful.' },
      { childName: 'Isabella Garcia', homeworkTitle: 'Simple Addition Practice', status: 'pending', grade: null, feedback: null }
    ];

    for (const submission of submissions) {
      // Check if submission exists
      const existing = await query(
        'SELECT id FROM homework_submissions WHERE homework_id = ? AND studentId = ?',
        [homeworkIds[submission.homeworkTitle], childIds[submission.childName]],
        'skydek_DB'
      );

      if (existing.length > 0) {
        console.log(`⚠️  Submission for "${submission.homeworkTitle}" by ${submission.childName} already exists`);
      } else {
        const submittedAt = submission.status === 'graded' ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : new Date();
        
        // Create the results object for submission data
        const results = {
          submissionText: `Submitted work for ${submission.homeworkTitle}`,
          attachments: [],
          feedback: submission.feedback || ''
        };
        
        await execute(
          'INSERT INTO homework_submissions (homework_id, studentId, studentName, className, grade, teacherId, date, day, results, type, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            homeworkIds[submission.homeworkTitle],
            childIds[submission.childName],
            submission.childName,
            // Get className from children data
            children.find(c => c.name === submission.childName)?.className || 'Unknown',
            submission.grade || '',
            // Get teacherId from homework assignment
            Object.values(teacherIds).find((id, index) => Object.keys(teacherIds)[index] === children.find(c => c.name === submission.childName)?.className) || 1,
            submittedAt,
            submittedAt.toLocaleDateString('en-US', { weekday: 'long' }),
            JSON.stringify(results),
            'homework',
            submission.status,
            submittedAt,
            submittedAt
          ],
          'skydek_DB'
        );
        console.log(`✅ Created submission: ${submission.childName} - "${submission.homeworkTitle}" (${submission.status})`);
      }
    }

    // ========================================
    // 6. Create Sample Messages/Notifications
    // ========================================
    console.log('\n6️⃣ Creating sample messages and notifications...');
    
    // Check if messages table exists
    try {
      await query('SELECT 1 FROM messages LIMIT 1', [], 'skydek_DB');
      
      const sampleMessages = [
        {
          sender_id: teacherIds['Eagles'],
          sender_type: 'teacher',
          recipient_id: parentIds['jessica.martinez@email.com'],
          recipient_type: 'parent',
          content: 'Sofia has been doing excellent work in class! Her creativity in art projects is remarkable.',
          subject: 'Sofia\'s Progress Update'
        },
        {
          sender_id: teacherIds['Falcons'],
          sender_type: 'teacher',
          recipient_id: parentIds['michael.thompson@email.com'],
          recipient_type: 'parent',
          content: 'Emma showed great leadership during our group reading activity today. She helped her classmates with pronunciation.',
          subject: 'Emma\'s Leadership Skills'
        },
        {
          sender_id: teacherIds['Hawks'],
          sender_type: 'teacher',
          recipient_id: parentIds['robert.garcia@email.com'],
          recipient_type: 'parent',
          content: 'Lucas has improved significantly in his number recognition. Keep up the great practice at home!',
          subject: 'Lucas\'s Math Progress'
        }
      ];

      for (const message of sampleMessages) {
        await execute(
          'INSERT INTO messages (sender_id, sender_type, recipient_id, recipient_type, content, subject, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
          [message.sender_id, message.sender_type, message.recipient_id, message.recipient_type, message.content, message.subject],
          'skydek_DB'
        );
        console.log(`✅ Created message: "${message.subject}"`);
      }
    } catch (error) {
      console.log('⚠️  Messages table not found, skipping message creation');
    }

    // ========================================
    // 7. Summary Report
    // ========================================
    console.log('\n🎉 Marketing Demo Data Created Successfully!');
    console.log('='.repeat(60));
    console.log('\n📊 DATA SUMMARY:');
    console.log(`👨‍🏫 Teachers: ${teachers.length}`);
    console.log(`👨‍👩‍👧‍👦 Parents: ${parents.length}`);
    console.log(`👶 Children: ${children.length}`);
    console.log(`📝 Homework Assignments: ${homeworkAssignments.length}`);
    console.log(`📤 Submissions: ${submissions.length}`);
    
    console.log('\n🎯 DEMO LOGIN CREDENTIALS FOR MARKETING:');
    console.log('='.repeat(60));
    console.log('\n🌟 MAIN DEMO PARENT (Best for screenshots):');
    console.log('📧 Email: jessica.martinez@email.com');
    console.log('🔑 Password: Parent@123');
    console.log('👶 Children: Sofia Martinez (Eagles), Diego Martinez (Hawks)');
    console.log('📊 Features: Multiple children, completed homework, pending assignments');
    
    console.log('\n🌟 SECONDARY DEMO PARENTS:');
    console.log('📧 Email: michael.thompson@email.com');
    console.log('🔑 Password: Parent@123');
    console.log('👶 Children: Emma Thompson (Falcons), Noah Thompson (Eagles)');
    
    console.log('📧 Email: robert.garcia@email.com');
    console.log('🔑 Password: Parent@123');
    console.log('👶 Children: Lucas Garcia (Hawks), Isabella Garcia (Falcons)');
    
    console.log('📧 Email: amanda.wilson@email.com');
    console.log('🔑 Password: Parent@123');
    console.log('👶 Children: Ava Wilson (Owls)');
    
    console.log('\n🎬 MARKETING SCREENSHOT FEATURES TO HIGHLIGHT:');
    console.log('✅ Multiple children management');
    console.log('✅ Homework progress tracking with percentages');
    console.log('✅ Graded assignments with teacher feedback');
    console.log('✅ Pending assignments with due dates');
    console.log('✅ Progress reports with detailed analytics');
    console.log('✅ AI Parent Assistant activation');
    console.log('✅ Quick action buttons with badges');
    console.log('✅ Teacher communication messages');
    console.log('✅ Professional class organization');
    
    console.log('\n🚀 NEXT STEPS FOR MARKETING:');
    console.log('1. Start the API server: npm start');
    console.log('2. Start the PWA frontend');
    console.log('3. Login with demo parent credentials');
    console.log('4. Navigate through parent dashboard features');
    console.log('5. Take screenshots of key features');
    console.log('6. Show AI Assistant in action');
    console.log('7. Demonstrate homework submission flow');
    
    console.log('\n='.repeat(60));
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error creating marketing demo data:', error);
    process.exit(1);
  }
};

// Run the demo data creation
createMarketingDemoData();
