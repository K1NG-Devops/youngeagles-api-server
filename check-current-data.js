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

async function checkCurrentData() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully!');
    
    // Check available classes
    console.log('\n📚 Available Classes:');
    const [classes] = await connection.query(`
SELECT *
      FROM classes 
      ORDER BY id
    `);
    console.table(classes);
    
    // Check Martin Baker's existing children
    console.log('\n👦👧 Martin Baker\'s Current Children:');
    const [martinsChildren] = await connection.query(`
      SELECT c.id, c.name, c.grade, c.className, c.age, c.class_id, cl.name as actualClassName
      FROM children c
      LEFT JOIN classes cl ON c.class_id = cl.id
      WHERE c.parent_id = 25
      ORDER BY c.name
    `);
    console.table(martinsChildren);
    
    // Check all homework for existing grades
    console.log('\n📝 Existing Homework by Grade:');
    const [homework] = await connection.query(`
      SELECT h.id, h.title, h.grade, h.status, h.points, s.name as teacher_name
      FROM homework h
      LEFT JOIN staff s ON h.teacher_id = s.id
      ORDER BY h.grade, h.created_at DESC
    `);
    console.table(homework);
    
    // Check Martin's notifications
    console.log('\n🔔 Martin\'s Current Notifications:');
    const [notifications] = await connection.query(`
      SELECT id, title, body, type, isRead, createdAt
      FROM notifications 
      WHERE userId = 25 
      ORDER BY createdAt DESC 
      LIMIT 10
    `);
    console.table(notifications);
    
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

checkCurrentData();
