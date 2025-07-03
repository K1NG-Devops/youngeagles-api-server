import dotenv from 'dotenv';
import { initDatabase, query } from './src/db.js';

dotenv.config();

async function checkAdminUsers() {
  try {
    console.log('🔍 Checking admin users in database...\n');
    
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      console.log('❌ Could not connect to database');
      return;
    }

    // Check staff table structure
    console.log('📋 Staff table structure:');
    const staffColumns = await query('DESCRIBE staff');
    console.log(staffColumns);
    console.log('');

    // Check all admin users
    console.log('👑 Admin users in staff table:');
    const adminUsers = await query('SELECT id, name, email, role FROM staff WHERE role = "admin"');
    console.log(adminUsers);
    console.log('');

    // Check all users in staff table
    console.log('👥 All users in staff table:');
    const allStaff = await query('SELECT id, name, email, role FROM staff ORDER BY role, name');
    console.log(allStaff);
    console.log('');

    // Check users table structure
    console.log('📋 Users table structure:');
    const userColumns = await query('DESCRIBE users');
    console.log(userColumns);
    console.log('');

    // Check all users in users table
    console.log('👥 All users in users table:');
    const allUsers = await query('SELECT id, name, email, userType FROM users ORDER BY userType, name');
    console.log(allUsers);
    console.log('');

    // Check if the specific admin email exists
    const adminEmail = 'admin@youngeagles.org.za';
    console.log(`🔍 Looking for admin with email: ${adminEmail}`);
    
    const adminInStaff = await query('SELECT * FROM staff WHERE email = ?', [adminEmail]);
    console.log('In staff table:', adminInStaff);
    
    const adminInUsers = await query('SELECT * FROM users WHERE email = ?', [adminEmail]);
    console.log('In users table:', adminInUsers);

  } catch (error) {
    console.error('❌ Error checking admin users:', error);
  }
}

checkAdminUsers().catch(console.error); 