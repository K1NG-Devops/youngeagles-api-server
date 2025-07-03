import dotenv from 'dotenv';
import { initDatabase, query } from './src/db.js';
import bcrypt from 'bcrypt';

dotenv.config();

async function debugAuth() {
  try {
    console.log('🔍 Debugging authentication issues...\n');
    
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      console.log('❌ Could not connect to database');
      return;
    }

    // Check admin user password
    console.log('🔑 Checking admin password...');
    const adminUser = await query('SELECT * FROM staff WHERE email = ? AND role = "admin"', ['admin@youngeagles.org.za']);
    console.log('Admin user found:', adminUser.length > 0);
    if (adminUser.length > 0) {
      console.log('Admin password hash:', adminUser[0].password);
      const testPassword = '#Admin@2012';
      const isValid = await bcrypt.compare(testPassword, adminUser[0].password);
      console.log('Password validation:', isValid);
    }
    console.log('');

    // Check if users table exists and has parent users
    console.log('👥 Checking users table for parents...');
    try {
      const usersTable = await query('SHOW TABLES LIKE "users"');
      console.log('Users table exists:', usersTable.length > 0);
      
      if (usersTable.length > 0) {
        const parentUsers = await query('SELECT * FROM users WHERE userType = "parent" LIMIT 5');
        console.log('Parent users found:', parentUsers.length);
        console.log('Sample parent user:', parentUsers[0] || 'None');
      }
    } catch (error) {
      console.log('Users table error:', error.message);
    }
    console.log('');

    // Check if teachers table exists
    console.log('👩‍🏫 Checking teachers table...');
    try {
      const teachersTable = await query('SHOW TABLES LIKE "teachers"');
      console.log('Teachers table exists:', teachersTable.length > 0);
    } catch (error) {
      console.log('Teachers table error:', error.message);
    }
    console.log('');

    // Check staff table for teachers
    console.log('👩‍🏫 Checking staff table for teachers...');
    const teachers = await query('SELECT id, name, email, role FROM staff WHERE role = "teacher" LIMIT 5');
    console.log('Teachers in staff table:', teachers.length);
    console.log('Sample teacher:', teachers[0] || 'None');
    console.log('');

    // Test password hashing
    console.log('🔐 Testing password hashing...');
    const testPassword = 'password123';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    console.log('Original password:', testPassword);
    console.log('Hashed password:', hashedPassword);
    const isValid = await bcrypt.compare(testPassword, hashedPassword);
    console.log('Hash validation:', isValid);

  } catch (error) {
    console.error('❌ Error debugging auth:', error);
  }
}

debugAuth().catch(console.error); 