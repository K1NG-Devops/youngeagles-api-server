/**
 * Fix Attendance Table Structure
 * This script checks and updates the attendance table to match our expected schema
 */

import { initDatabase, query } from './src/db.js';

console.log('🔧 Fixing Attendance Table Structure...\n');

async function checkAndFixAttendanceTable() {
  try {

    console.log('📋 Checking current attendance table structure...');
    
    // Check current table structure
    const columns = await query("DESCRIBE attendance");
    console.log('Current columns:', columns.map(col => col.Field).join(', '));

    // Check if required columns exist
    const requiredColumns = ['marked_at', 'teacher_id'];
    const existingColumns = columns.map(col => col.Field);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log(`⚠️ Missing columns: ${missingColumns.join(', ')}`);
      console.log('🔨 Adding missing columns...');

      for (const column of missingColumns) {
        try {
          if (column === 'marked_at') {
            await query('ALTER TABLE attendance ADD COLUMN marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
            console.log('✅ Added marked_at column');
          } else if (column === 'teacher_id') {
            await query('ALTER TABLE attendance ADD COLUMN teacher_id INT NOT NULL DEFAULT 0');
            console.log('✅ Added teacher_id column');
          }
        } catch (error) {
          console.log(`❌ Error adding ${column}:`, error.message);
        }
      }
    } else {
      console.log('✅ All required columns exist');
    }

    // Check updated structure
    console.log('\n📋 Updated table structure:');
    const updatedColumns = await query("DESCRIBE attendance");
    updatedColumns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });

    return true;

  } catch (error) {
    console.error('❌ Error fixing attendance table:', error);
    return false;
  }
}

async function createAttendanceTableIfNotExists() {
  try {
    // Initialize database connection
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      console.log('❌ Could not connect to database');
      return false;
    }
    
    console.log('🔍 Checking if attendance table exists...');
    
    const tables = await query("SHOW TABLES LIKE 'attendance'");
    
    if (tables.length === 0) {
      console.log('📋 Creating attendance table...');
      
      const createTableSQL = `
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
      
      await query(createTableSQL);
      console.log('✅ Created attendance table with all required columns');
      return true;
    } else {
      console.log('✅ Attendance table exists');
      return await checkAndFixAttendanceTable();
    }
    
  } catch (error) {
    console.error('❌ Error creating/checking attendance table:', error);
    return false;
  }
}

// Run the fix
if (import.meta.url === `file://${process.argv[1]}`) {
  createAttendanceTableIfNotExists()
    .then((success) => {
      if (success) {
        console.log('\n🎉 Attendance table is now ready!');
        console.log('💡 You can now test the attendance endpoints');
      } else {
        console.log('\n❌ Failed to fix attendance table');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

export { createAttendanceTableIfNotExists, checkAndFixAttendanceTable };
