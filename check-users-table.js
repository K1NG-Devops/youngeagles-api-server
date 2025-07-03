import dotenv from 'dotenv';
import { initDatabase, query } from './src/db.js';

dotenv.config();

async function checkUsersTable() {
  try {
    console.log('🔍 Checking users table structure...\n');
    
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      console.log('❌ Could not connect to database');
      return;
    }

    // Check users table structure
    console.log('📋 Users table structure:');
    const userColumns = await query('DESCRIBE users');
    console.log(userColumns);
    console.log('');

    // Check all users in users table
    console.log('👥 All users in users table:');
    const allUsers = await query('SELECT * FROM users LIMIT 10');
    console.log(allUsers);
    console.log('');

    // Check if there are any parent users
    console.log('👨‍👩‍👧‍👦 Checking for parent users...');
    const parentUsers = await query('SELECT * FROM users WHERE role = "parent" LIMIT 5');
    console.log('Parent users found:', parentUsers.length);
    if (parentUsers.length > 0) {
      console.log('Sample parent:', parentUsers[0]);
    }

  } catch (error) {
    console.error('❌ Error checking users table:', error);
  }
}

checkUsersTable().catch(console.error); 