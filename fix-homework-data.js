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

async function fixHomeworkData() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully!');
    
    // 1. First, delete the incorrect homework assignments for Grade 3 and Grade 5
    console.log('\n🗑️  Removing incorrect homework assignments...');
    const [deleteResult] = await connection.query(`
      DELETE FROM homework 
      WHERE grade IN ('Grade 3', 'Grade 5')
    `);
    console.log(`✅ Deleted ${deleteResult.affectedRows} incorrect homework assignments`);
    
    // 2. Create homework assignments for the correct grades (RR and R)
    console.log('\n📚 Creating homework for correct grades...');
    
    // Get teacher IDs
    const [teachers] = await connection.query(`
      SELECT id, name FROM staff 
      WHERE email IN ('sarah.johnson@youngeagles.org.za', 'david.smith@youngeagles.org.za')
    `);
    
    const sarahId = teachers.find(t => t.name === 'Ms. Sarah Johnson')?.id;
    const davidId = teachers.find(t => t.name === 'Mr. David Smith')?.id;
    
    if (!sarahId || !davidId) {
      console.log('⚠️  Teachers not found, creating them...');
      // Teachers should exist from previous seeding, but let's ensure they do
      return;
    }
    
    // Create homework for RR grade (Curious Cubs)
    const [rrHomework1] = await connection.query(`
      INSERT INTO homework (title, description, due_date, teacher_id, grade, status, points) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      'Color and Play Time',
      'Color the pictures in your activity book and play with shapes.',
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      sarahId,
      'RR',
      'active',
      5
    ]);
    
    const [rrHomework2] = await connection.query(`
      INSERT INTO homework (title, description, due_date, teacher_id, grade, status, points) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      'Story Time Activity',
      'Listen to a story with your parent and draw your favorite character.',
      new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      davidId,
      'RR',
      'active',
      5
    ]);
    
    // Create homework for R grade (Panda)
    const [rHomework1] = await connection.query(`
      INSERT INTO homework (title, description, due_date, teacher_id, grade, status, points) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      'Counting Fun',
      'Count objects around your house and write the numbers 1-10.',
      new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      sarahId,
      'R',
      'active',
      10
    ]);
    
    const [rHomework2] = await connection.query(`
      INSERT INTO homework (title, description, due_date, teacher_id, grade, status, points) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      'Letter Practice',
      'Practice writing your name and the letters A-F.',
      new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
      davidId,
      'R',
      'active',
      10
    ]);
    
    console.log('✅ Created 4 new homework assignments for RR and R grades');
    
    // 3. Now create some submissions to show activity
    console.log('\n📝 Creating sample submissions...');
    
    // Get Martin's children in correct grades
    const [children] = await connection.query(`
      SELECT id, name, grade FROM children 
      WHERE parent_id = 25 AND grade IN ('RR', 'R', 'Nursery')
    `);
    
    if (children.length > 0) {
      // Create a sample submission for one of the children
      const child = children[0];
      
      // Check if homework_submissions table has the right structure
      const [submissionStructure] = await connection.query('DESCRIBE homework_submissions');
      const hasHomeworkId = submissionStructure.some(col => col.Field === 'homework_id');
      
      if (hasHomeworkId) {
        // Create a submission using the homework_submissions table
        await connection.query(`
          INSERT INTO homework_submissions 
          (homework_id, studentId, studentName, className, grade, teacherId, date, day, results, type, status, createdAt) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          rrHomework1.insertId,
          child.id,
          child.name,
          'Curious Cubs',
          child.grade,
          sarahId,
          new Date(),
          new Date().toLocaleDateString('en-US', { weekday: 'long' }),
          JSON.stringify(['Completed coloring activity']),
          'homework_submission',
          'submitted',
          new Date()
        ]);
        
        console.log(`✅ Created sample submission for ${child.name}`);
      }
    }
    
    // 4. Update notifications to reflect the correct homework
    console.log('\n🔔 Updating notifications...');
    await connection.query(`
      DELETE FROM notifications 
      WHERE userId = 25 AND type = 'homework'
    `);
    
    await connection.query(`
      INSERT INTO notifications (userId, userType, title, body, type, isRead, createdAt, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      25,
      'parent',
      'New Age-Appropriate Homework',
      'Your children have new homework assignments suited for their age groups!',
      'homework',
      0,
      new Date(),
      new Date()
    ]);
    
    console.log('✅ Updated notifications');
    
    // 5. Verify the fixes
    console.log('\n🔍 Verifying fixes...');
    
    const [homeworkCheck] = await connection.query(`
      SELECT h.id, h.title, h.grade, h.status, h.points, s.name as teacher_name
      FROM homework h
      LEFT JOIN staff s ON h.teacher_id = s.id
      WHERE h.grade IN ('RR', 'R')
      ORDER BY h.created_at DESC
    `);
    
    console.log('\n📚 New Homework Assignments:');
    console.table(homeworkCheck);
    
    const [childrenCheck] = await connection.query(`
      SELECT id, name, grade, className, parent_id
      FROM children 
      WHERE parent_id = 25
      ORDER BY name
    `);
    
    console.log('\n👦👧 Martin\'s Children:');
    console.table(childrenCheck);
    
    // Test homework fetch query that the API might use
    console.log('\n🔎 Testing homework fetch for Martin\'s children...');
    const [homeworkForChildren] = await connection.query(`
      SELECT DISTINCT h.*, s.name as teacher_name
      FROM homework h
      LEFT JOIN staff s ON h.teacher_id = s.id
      WHERE h.grade IN (
        SELECT DISTINCT grade FROM children WHERE parent_id = 25
      )
      AND h.status = 'active'
      ORDER BY h.due_date ASC
    `);
    
    console.log(`\n📋 Homework matching children's grades: ${homeworkForChildren.length} items`);
    console.table(homeworkForChildren);
    
    // Check submissions count
    const [submissionCount] = await connection.query(`
      SELECT COUNT(*) as submission_count
      FROM homework_submissions hs
      WHERE hs.studentId IN (
        SELECT id FROM children WHERE parent_id = 25
      )
    `);
    
    console.log(`\n📊 Submissions for Martin's children: ${submissionCount[0].submission_count}`);
    
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

fixHomeworkData();
