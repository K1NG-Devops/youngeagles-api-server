#!/usr/bin/env node

import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'shuttle.proxy.rlwy.net',
  port: process.env.DB_PORT || 49263,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'fhdgRvbocRQKcikxGTNsQUHVIMizngLb',
  database: process.env.DB_NAME || 'skydek_DB',
  ssl: process.env.DB_SSL === 'true' || false
};

async function checkAdminUsers() {
  console.log('🔍 Checking admin and teacher accounts in database...');
  
  try {
    const db = mysql.createPool(dbConfig);
    
    // Check staff table
    console.log('\n📊 Staff accounts:');
    const [staff] = await db.execute('SELECT id, name, email, role FROM staff');
    
    if (staff.length === 0) {
      console.log('❌ No staff accounts found');
    } else {
      staff.forEach(s => {
        console.log(`✅ ${s.role}: ${s.name} (${s.email}) - ID: ${s.id}`);
      });
    }
    
    // Check users table for admin-like accounts
    console.log('\n👥 User accounts:');
    const [users] = await db.execute('SELECT id, name, email, role FROM users LIMIT 5');
    
    if (users.length === 0) {
      console.log('❌ No user accounts found');
    } else {
      users.forEach(u => {
        console.log(`✅ ${u.role}: ${u.name} (${u.email}) - ID: ${u.id}`);
      });
    }
    
    // Check if there are any admin-like entries
    console.log('\n🔍 Searching for admin accounts...');
    const [adminSearch] = await db.execute("SELECT 'staff' as table_name, id, name, email, role FROM staff WHERE role = 'admin' UNION ALL SELECT 'users' as table_name, id, name, email, role FROM users WHERE role = 'admin' OR email LIKE '%admin%'");
    
    if (adminSearch.length === 0) {
      console.log('❌ No admin accounts found');
    } else {
      adminSearch.forEach(a => {
        console.log(`🔑 Admin found in ${a.table_name}: ${a.name} (${a.email}) - Role: ${a.role}`);
      });
    }
    
    // Check if there are any teacher accounts
    console.log('\n👩‍🏫 Searching for teacher accounts...');
    const [teacherSearch] = await db.execute("SELECT 'staff' as table_name, id, name, email, role FROM staff WHERE role = 'teacher' UNION ALL SELECT 'users' as table_name, id, name, email, role FROM users WHERE role = 'teacher' OR email LIKE '%teacher%'");
    
    if (teacherSearch.length === 0) {
      console.log('❌ No teacher accounts found');
    } else {
      teacherSearch.forEach(t => {
        console.log(`👩‍🏫 Teacher found in ${t.table_name}: ${t.name} (${t.email}) - Role: ${t.role}`);
      });
    }
    
    await db.end();
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  }
}

checkAdminUsers(); 