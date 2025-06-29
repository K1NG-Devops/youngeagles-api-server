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

async function checkSubmissionsTable() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully!');
    
    // Check if homework_submissions table exists
    console.log('\n🔍 Checking if homework_submissions table exists:');
    try {
      const [submissionsStructure] = await connection.query('DESCRIBE homework_submissions');
      console.table(submissionsStructure);
    } catch (error) {
      console.log('❌ homework_submissions table does not exist:', error.message);
    }
    
    // Check what tables exist with 'homework' in name
    console.log('\n📋 Tables containing "homework":');
    const [tables] = await connection.query(`
      SHOW TABLES LIKE '%homework%'
    `);
    console.table(tables);
    
    // Check what tables exist in general
    console.log('\n📋 All available tables:');
    const [allTables] = await connection.query('SHOW TABLES');
    console.table(allTables);
    
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

checkSubmissionsTable();
