import bcrypt from 'bcryptjs';
import { query, execute } from './src/db.js';
import dotenv from 'dotenv';

dotenv.config();

const seedTeacher = async () => {
  try {
    console.log('👩‍🏫 Setting up teacher account...');
    
    const teacherData = {
      name: 'Test Teacher',
      email: 'teacher@youngeagles.org.za',
      password: 'Teacher@123',
      role: 'teacher'
    };

    // Hash password
    const hashedPassword = await bcrypt.hash(teacherData.password, 12);

    // Check if teacher already exists in staff table
    const existingTeacher = await query(
      'SELECT id FROM staff WHERE email = ? AND role = ?',
      [teacherData.email, teacherData.role],
      'skydek_DB'
    );

    if (existingTeacher.length > 0) {
      console.log('⚠️  Teacher user already exists. Updating...');
      
      await execute(
        'UPDATE staff SET name = ?, password = ?, is_verified = TRUE WHERE email = ? AND role = ?',
        [teacherData.name, hashedPassword, teacherData.email, teacherData.role],
        'skydek_DB'
      );
      
      console.log('✅ Teacher user updated successfully!');
    } else {
      console.log('➕ Creating new teacher user...');
      
      await execute(
        'INSERT INTO staff (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, TRUE)',
        [teacherData.name, teacherData.email, hashedPassword, teacherData.role],
        'skydek_DB'
      );
      
      console.log('✅ Teacher user created successfully!');
    }

    console.log('\n🎉 Teacher setup complete!');
    console.log('='.repeat(50));
    console.log('Teacher Login Credentials:');
    console.log(`📧 Email: ${teacherData.email}`);
    console.log(`🔑 Password: ${teacherData.password}`);
    console.log('='.repeat(50));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up teacher:', error);
    process.exit(1);
  }
};

// Run the seeding script
seedTeacher(); 