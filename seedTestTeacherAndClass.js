import crypto from 'crypto';
import { query, execute } from './src/db.js';
import dotenv from 'dotenv';

dotenv.config();

// Use the same password hashing method as the API (PBKDF2)
function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const seedTestTeacherAndClass = async () => {
  try {
    console.log('🎯 Setting up test teacher with class and students...\n');
    
    // 1. Set up test teacher data
    const teacherData = {
      name: 'Test Teacher',
      email: 'test.teacher@youngeagles.org.za',
      password: 'Test@123',
      role: 'teacher',
      className: 'Panda' // Assign to Panda class
    };

    console.log('1️⃣ Creating test teacher...');
    
    // Hash password using PBKDF2 (same as API)
    const hashedPassword = hashPassword(teacherData.password);

    // Check if teacher exists in staff table
    const existingTeacher = await query(
      'SELECT id FROM staff WHERE email = ? AND role = ?',
      [teacherData.email, teacherData.role],
      'skydek_DB'
    );

    let teacherId;
    if (existingTeacher.length > 0) {
      teacherId = existingTeacher[0].id;
      console.log('⚠️  Teacher already exists. Updating...');
      
      await execute(
        'UPDATE staff SET name = ?, password = ?, className = ?, is_verified = TRUE WHERE email = ? AND role = ?',
        [teacherData.name, hashedPassword, teacherData.className, teacherData.email, teacherData.role],
        'skydek_DB'
      );
      
      console.log('✅ Teacher updated successfully!');
    } else {
      console.log('➕ Creating new teacher...');
      
      const result = await execute(
        'INSERT INTO staff (name, email, password, role, className, is_verified) VALUES (?, ?, ?, ?, ?, TRUE)',
        [teacherData.name, teacherData.email, hashedPassword, teacherData.role, teacherData.className],
        'skydek_DB'
      );
      
      teacherId = result.insertId;
      console.log('✅ Teacher created successfully!');
    }

    // 2. Create test parent
    console.log('\n2️⃣ Creating test parent...');
    
    const parentData = {
      name: 'Test Parent',
      email: 'test.parent@youngeagles.org.za',
      password: 'Parent@123',
      role: 'parent',
      address: 'Test Address, Johannesburg'
    };

    // Hash parent password
    const parentHashedPassword = hashPassword(parentData.password);

    // Check if parent exists
    const existingParent = await query(
      'SELECT id FROM users WHERE email = ? AND role = ?',
      [parentData.email, parentData.role],
      'skydek_DB'
    );

    let parentId;
    if (existingParent.length > 0) {
      parentId = existingParent[0].id;
      console.log('⚠️  Parent already exists. Using existing parent...');
    } else {
      console.log('➕ Creating new parent...');
      
      const parentResult = await execute(
        'INSERT INTO users (name, email, password, role, address) VALUES (?, ?, ?, ?, ?)',
        [parentData.name, parentData.email, parentHashedPassword, parentData.role, parentData.address],
        'skydek_DB'
      );
      
      parentId = parentResult.insertId;
      console.log('✅ Parent created successfully!');
    }

    // 3. Create test students
    console.log('\n3️⃣ Creating test students...');
    
    const testStudents = [
      { name: 'Emma Johnson', age: 5, className: 'Panda' },
      { name: 'Liam Smith', age: 4, className: 'Panda' },
      { name: 'Sophia Davis', age: 6, className: 'Panda' },
      { name: 'Oliver Wilson', age: 5, className: 'Panda' },
      { name: 'Ava Brown', age: 4, className: 'Panda' }
    ];

    for (const student of testStudents) {
      // Check if student exists
      const existingStudent = await query(
        'SELECT id FROM children WHERE name = ? AND className = ?',
        [student.name, student.className],
        'skydek_DB'
      );

      if (existingStudent.length > 0) {
        console.log(`⚠️  Student ${student.name} already exists. Updating...`);
        
        await execute(
          'UPDATE children SET age = ?, className = ?, parent_id = ? WHERE name = ?',
          [student.age, student.className, parentId, student.name],
          'skydek_DB'
        );
        
        console.log(`✅ Student ${student.name} updated`);
      } else {
        console.log(`➕ Creating new student ${student.name}...`);
        
        await execute(
          'INSERT INTO children (name, age, className, parent_id) VALUES (?, ?, ?, ?)',
          [student.name, student.age, student.className, parentId],
          'skydek_DB'
        );
        
        console.log(`✅ Student ${student.name} created`);
      }
    }

    // 4. Verify setup
    console.log('\n4️⃣ Verifying setup...');
    
    const teacherCheck = await query(
      'SELECT id, name, email, className FROM staff WHERE id = ?',
      [teacherId],
      'skydek_DB'
    );
    
    const studentsCheck = await query(
      'SELECT id, name, age, className FROM children WHERE className = ?',
      [teacherData.className],
      'skydek_DB'
    );

    console.log('\n🎉 Setup Complete!');
    console.log('='.repeat(50));
    console.log('Test Teacher Details:');
    console.log(`📧 Email: ${teacherData.email}`);
    console.log(`🔑 Password: ${teacherData.password}`);
    console.log(`📚 Class: ${teacherData.className}`);
    console.log(`👥 Students in class: ${studentsCheck.length}`);
    console.log('\nTest Parent Details:');
    console.log(`📧 Email: ${parentData.email}`);
    console.log(`🔑 Password: ${parentData.password}`);
    console.log('='.repeat(50));
    console.log('\nStudents:');
    studentsCheck.forEach((student, index) => {
      console.log(`${index + 1}. ${student.name} (${student.age} years)`);
    });
    console.log('='.repeat(50));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in setup:', error);
    process.exit(1);
  }
};

// Run the seeding script
seedTestTeacherAndClass(); 