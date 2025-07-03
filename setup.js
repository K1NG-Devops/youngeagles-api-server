/**
 * Setup Script for Young Eagles API
 * Initializes database tables and checks dependencies
 */

import fs from 'fs';
import path from 'path';
import { initDatabase, query } from './src/db.js';

console.log('🚀 Young Eagles API Setup\n');

async function checkDependencies() {
  console.log('📦 Checking dependencies...');
  
  try {
    // Check if package.json exists
    if (!fs.existsSync('package.json')) {
      throw new Error('package.json not found');
    }
    
    // Check if node_modules exists
    if (!fs.existsSync('node_modules')) {
      console.log('⚠️ node_modules not found. Please run: npm install');
      return false;
    }
    
    console.log('✅ Dependencies check passed');
    return true;
  } catch (error) {
    console.log(`❌ Dependencies check failed: ${error.message}`);
    return false;
  }
}

async function createUploadsDirectory() {
  console.log('📁 Creating uploads directory...');
  
  try {
    const uploadDir = path.join(process.cwd(), 'uploads', 'homework');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('✅ Created uploads/homework directory');
    } else {
      console.log('✅ uploads/homework directory already exists');
    }
    return true;
  } catch (error) {
    console.log(`❌ Failed to create uploads directory: ${error.message}`);
    return false;
  }
}

async function checkDatabaseTables() {
  console.log('🗄️ Checking database tables...');
  
  try {
    // Check if homework_submissions table exists
    const tables = await query("SHOW TABLES LIKE 'homework_submissions'");
    
    if (tables.length === 0) {
      console.log('⚠️ homework_submissions table not found. Creating it...');
      
      const createTableSQL = `
        CREATE TABLE homework_submissions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          homework_id INT NOT NULL,
          child_id INT NOT NULL,
          submitted_at DATETIME NOT NULL,
          file_url VARCHAR(500),
          grade DECIMAL(5,2),
          feedback TEXT,
          graded_at DATETIME,
          status ENUM('submitted', 'graded', 'returned') DEFAULT 'submitted',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          
          INDEX idx_homework_id (homework_id),
          INDEX idx_child_id (child_id),
          INDEX idx_status (status),
          INDEX idx_submitted_at (submitted_at),
          UNIQUE KEY unique_submission (homework_id, child_id)
        )
      `;
      
      await query(createTableSQL);
      console.log('✅ Created homework_submissions table');
    } else {
      console.log('✅ homework_submissions table exists');
    }
    
    // Check if attendance table exists
    const attendanceTables = await query("SHOW TABLES LIKE 'attendance'");
    
    if (attendanceTables.length === 0) {
      console.log('⚠️ attendance table not found. Creating it...');
      
      const createAttendanceTableSQL = `
        CREATE TABLE attendance (
          id INT AUTO_INCREMENT PRIMARY KEY,
          child_id INT NOT NULL,
          teacher_id INT NOT NULL,
          date DATE NOT NULL,
          status ENUM('present', 'absent', 'late') NOT NULL,
          notes TEXT,
          marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          
          INDEX idx_child_id (child_id),
          INDEX idx_teacher_id (teacher_id),
          INDEX idx_date (date),
          INDEX idx_status (status),
          INDEX idx_child_date (child_id, date),
          UNIQUE KEY unique_attendance (child_id, date)
        )
      `;
      
      await query(createAttendanceTableSQL);
      console.log('✅ Created attendance table');
    } else {
      console.log('✅ attendance table exists');
    }
    
    // Check other required tables
    const requiredTables = ['children', 'homeworks', 'users', 'staff'];
    const existingTables = await query("SHOW TABLES");
    const tableNames = existingTables.map(row => Object.values(row)[0]);
    
    for (const table of requiredTables) {
      if (tableNames.includes(table)) {
        console.log(`✅ ${table} table exists`);
      } else {
        console.log(`⚠️ ${table} table not found`);
      }
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Database tables check failed: ${error.message}`);
    return false;
  }
}

async function checkEnvironmentVariables() {
  console.log('🔧 Checking environment variables...');
  
  const requiredVars = [
    'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
    'JWT_SECRET'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log(`⚠️ Missing environment variables: ${missingVars.join(', ')}`);
    console.log('   Please create a .env file with all required variables');
    return false;
  }
  
  console.log('✅ Environment variables check passed');
  return true;
}

async function runSetup() {
  try {
    // Check dependencies
    const depsOk = await checkDependencies();
    if (!depsOk) {
      console.log('\n❌ Setup failed: Dependencies missing');
      return;
    }
    
    // Check environment variables
    const envOk = await checkEnvironmentVariables();
    if (!envOk) {
      console.log('\n❌ Setup failed: Environment variables missing');
      return;
    }
    
    // Create uploads directory
    const uploadsOk = await createUploadsDirectory();
    if (!uploadsOk) {
      console.log('\n❌ Setup failed: Could not create uploads directory');
      return;
    }
    
    // Initialize database connection
    console.log('🔌 Connecting to database...');
    const dbConnected = await initDatabase();
    
    if (!dbConnected) {
      console.log('\n❌ Setup failed: Could not connect to database');
      return;
    }
    
    // Check database tables
    const tablesOk = await checkDatabaseTables();
    if (!tablesOk) {
      console.log('\n❌ Setup failed: Database tables check failed');
      return;
    }
    
    console.log('\n🎉 Setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run dev (to start the development server)');
    console.log('2. Run: npm test (to test all API endpoints)');
    console.log('3. Check API_DOCUMENTATION.md for endpoint details');
    
  } catch (error) {
    console.log(`\n❌ Setup failed: ${error.message}`);
  }
}

// Run setup
runSetup().catch(console.error); 