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

async function checkTableStructure() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully!');
    
    // Check children table structure
    console.log('\n📋 Children table structure:');
    const [childrenStructure] = await connection.query('DESCRIBE children');
    console.table(childrenStructure);
    
    // Check if notifications table exists
    console.log('\n📋 Checking if notifications table exists:');
    try {
      const [notificationsStructure] = await connection.query('DESCRIBE notifications');
      console.table(notificationsStructure);
    } catch (error) {
      console.log('⚠️  Notifications table does not exist');
    }
    
    // Check staff table structure
    console.log('\n📋 Staff table structure:');
    const [staffStructure] = await connection.query('DESCRIBE staff');
    console.table(staffStructure);
    
    // Check homework table structure
    console.log('\n📋 Homework table structure:');
    const [homeworkStructure] = await connection.query('DESCRIBE homework');
    console.table(homeworkStructure);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔐 Database connection closed');
    }
  }
}

checkTableStructure();
