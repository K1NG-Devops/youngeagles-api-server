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

async function debugHomeworkIssues() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully!');
    
    // Check Martin Baker's children
    console.log('\n👦👧 Martin Baker\'s Children:');
    const [children] = await connection.query(`
      SELECT id, name, grade, className, age, class_id, parent_id
      FROM children 
      WHERE parent_id = 25
      ORDER BY name
    `);
    console.table(children);
    
    // Check all homework assignments
    console.log('\n📚 All Homework Assignments:');
    const [allHomework] = await connection.query(`
      SELECT h.id, h.title, h.grade, h.status, h.teacher_id, h.class_id, h.created_at,
             s.name as teacher_name
      FROM homework h
      LEFT JOIN staff s ON h.teacher_id = s.id
      ORDER BY h.created_at DESC
    `);
    console.table(allHomework);
    
    // Check homework submissions for Martin's children
    console.log('\n📝 Homework Submissions for Martin\'s Children:');
    const [submissions] = await connection.query(`
      SELECT hs.id, hs.homework_id, hs.child_id, hs.status, hs.submission_date,
             c.name as child_name, h.title as homework_title
      FROM homework_submissions hs
      JOIN children c ON hs.child_id = c.id
      JOIN homework h ON hs.homework_id = h.id
      WHERE c.parent_id = 25
      ORDER BY hs.submission_date DESC
    `);
    console.table(submissions);
    
    // Check homework assignments that match children's grades
    console.log('\n🎯 Homework Matching Children\'s Grades:');
    const [matchingHomework] = await connection.query(`
      SELECT DISTINCT h.id, h.title, h.grade as homework_grade, h.status,
             c.name as child_name, c.grade as child_grade, c.id as child_id
      FROM homework h
      CROSS JOIN children c
      WHERE c.parent_id = 25 
        AND (h.grade = c.grade OR h.grade = c.className OR h.class_id = c.class_id)
      ORDER BY c.name, h.created_at DESC
    `);
    console.table(matchingHomework);
    
    // Check if homework table has class_id column
    console.log('\n🔍 Homework Table Structure:');
    const [homeworkStructure] = await connection.query('DESCRIBE homework');
    console.table(homeworkStructure);
    
    // Test specific API-like queries that might be used
    console.log('\n🔎 Testing API-Style Queries:');
    
    // Query 1: Get homework for parent (by children's grades)
    const [parentHomework] = await connection.query(`
      SELECT DISTINCT h.*, s.name as teacher_name
      FROM homework h
      LEFT JOIN staff s ON h.teacher_id = s.id
      WHERE h.grade IN (
        SELECT DISTINCT grade FROM children WHERE parent_id = 25
      )
      AND h.status = 'active'
      ORDER BY h.due_date ASC
    `);
    console.log(`\n📋 Homework for Parent (Query 1): ${parentHomework.length} items`);
    console.table(parentHomework);
    
    // Query 2: Get submissions count for parent
    const [submissionCount] = await connection.query(`
      SELECT COUNT(*) as submission_count
      FROM homework_submissions hs
      JOIN children c ON hs.child_id = c.id
      WHERE c.parent_id = 25
    `);
    console.log(`\n📊 Submission Count: ${submissionCount[0].submission_count}`);
    
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

debugHomeworkIssues();
