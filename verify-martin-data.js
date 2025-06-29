#!/usr/bin/env node

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
};

async function verifyMartinData() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully!');
    
    // Check children for Martin Baker
    console.log('\n👦👧 Children for Martin Baker (User ID 25):');
    const [children] = await connection.query(`
      SELECT id, name, grade, first_name, last_name, age, date_of_birth, enrollment_date 
      FROM children 
      WHERE parent_id = 25
      ORDER BY name
    `);
    console.table(children);
    
    // Check homework assignments
    console.log('\n📚 Homework Assignments for Grade 3 and Grade 5:');
    const [homework] = await connection.query(`
      SELECT h.id, h.title, h.description, h.grade, h.due_date, h.status, h.points, 
             s.name as teacher_name, h.created_at
      FROM homework h
      LEFT JOIN staff s ON h.teacher_id = s.id
      WHERE h.grade IN ('Grade 3', 'Grade 5')
      ORDER BY h.created_at DESC
    `);
    console.table(homework);
    
    // Check notifications for Martin
    console.log('\n🔔 Notifications for Martin Baker:');
    const [notifications] = await connection.query(`
      SELECT id, title, body, type, isRead, createdAt
      FROM notifications 
      WHERE userId = 25 
      ORDER BY createdAt DESC
    `);
    console.table(notifications);
    
    // Check staff/teachers
    console.log('\n👩‍🏫 Staff Members:');
    const [staff] = await connection.query(`
      SELECT id, name, email, role, created_at
      FROM staff 
      WHERE email IN ('sarah.johnson@youngeagles.org.za', 'david.smith@youngeagles.org.za')
      ORDER BY name
    `);
    console.table(staff);
    
    console.log('\n📊 Summary:');
    console.log(`✅ Children added: ${children.length}`);
    console.log(`✅ Homework assignments: ${homework.length}`);
    console.log(`✅ Notifications: ${notifications.length}`);
    console.log(`✅ Staff members: ${staff.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔐 Database connection closed');
    }
  }
}

verifyMartinData();
