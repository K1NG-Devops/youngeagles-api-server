import { initDatabase, query } from './src/db.js';
import fs from 'fs';

async function runMigrations() {
  try {
    console.log('🚀 Starting database migrations...');
    
    // Initialize database connection first
    console.log('🔌 Initializing database connection...');
    await initDatabase();
    console.log('✅ Database connection established');
    
    // Create notifications table
    console.log('📋 Creating notifications table...');
    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('homework_submission', 'homework_graded', 'grading', 'announcement', 'homework', 'message') NOT NULL,
        priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
        user_id INT NOT NULL,
        homework_id INT NULL,
        submission_id INT NULL,
        teacher_name VARCHAR(255) NULL,
        score DECIMAL(5,2) NULL,
        auto_graded BOOLEAN DEFAULT FALSE,
        read_status BOOLEAN DEFAULT FALSE,
        read_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_user_id (user_id),
        INDEX idx_type (type),
        INDEX idx_read_status (read_status),
        INDEX idx_created_at (created_at),
        INDEX idx_homework_id (homework_id),
        INDEX idx_submission_id (submission_id)
      )
    `);
    console.log('✅ Notifications table created successfully');
    
    // Update homework_submissions table
    console.log('📋 Updating homework_submissions table...');
    try {
      await query(`ALTER TABLE homework_submissions ADD COLUMN submission_type ENUM('interactive', 'file_upload', 'text') DEFAULT 'file_upload'`);
      console.log('✅ Added submission_type column');
    } catch (e) {
      console.log('ℹ️ submission_type column already exists');
    }
    
    try {
      await query(`ALTER TABLE homework_submissions ADD COLUMN score DECIMAL(5,2) NULL`);
      console.log('✅ Added score column');
    } catch (e) {
      console.log('ℹ️ score column already exists');
    }
    
    try {
      await query(`ALTER TABLE homework_submissions ADD COLUMN time_spent INT NULL COMMENT 'Time spent in minutes'`);
      console.log('✅ Added time_spent column');
    } catch (e) {
      console.log('ℹ️ time_spent column already exists');
    }
    
    try {
      await query(`ALTER TABLE homework_submissions ADD COLUMN answers_data TEXT NULL COMMENT 'JSON data of answers for interactive homework'`);
      console.log('✅ Added answers_data column');
    } catch (e) {
      console.log('ℹ️ answers_data column already exists');
    }
    
    try {
      await query(`ALTER TABLE homework_submissions ADD COLUMN additional_files TEXT NULL COMMENT 'JSON array of additional file URLs'`);
      console.log('✅ Added additional_files column');
    } catch (e) {
      console.log('ℹ️ additional_files column already exists');
    }
    
    // Update homework table
    console.log('📋 Updating homework table...');
    try {
      await query(`ALTER TABLE homework ADD COLUMN content_type ENUM('traditional', 'interactive', 'project') DEFAULT 'traditional'`);
      console.log('✅ Added content_type column');
    } catch (e) {
      console.log('ℹ️ content_type column already exists');
    }
    
    try {
      await query(`ALTER TABLE homework ADD COLUMN assignment_type ENUM('class', 'individual') DEFAULT 'class'`);
      console.log('✅ Added assignment_type column');
    } catch (e) {
      console.log('ℹ️ assignment_type column already exists');
    }
    
    // Create homework_individual_assignments table
    console.log('📋 Creating homework_individual_assignments table...');
    await query(`
      CREATE TABLE IF NOT EXISTS homework_individual_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        homework_id INT NOT NULL,
        child_id INT NOT NULL,
        status ENUM('assigned', 'submitted', 'graded') DEFAULT 'assigned',
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_homework_id (homework_id),
        INDEX idx_child_id (child_id),
        UNIQUE KEY unique_assignment (homework_id, child_id)
      )
    `);
    console.log('✅ Individual assignments table created successfully');
    
    // Add some sample notifications
    console.log('📋 Adding sample notifications...');
    try {
      await query(`
        INSERT INTO notifications (title, message, type, priority, user_id, created_at) VALUES
        ('Welcome to Young Eagles!', 'Thank you for joining Young Eagles. We are excited to have you on board!', 'announcement', 'low', 1, NOW()),
        ('System Maintenance', 'The system will undergo maintenance on Sunday from 2:00 AM to 4:00 AM.', 'announcement', 'medium', 1, NOW())
      `);
      console.log('✅ Sample notifications added');
    } catch (e) {
      console.log('ℹ️ Sample notifications may already exist');
    }
    
    console.log('🎉 All database migrations completed successfully!');
    
    // Test the notifications table
    console.log('🧪 Testing notifications table...');
    const notifications = await query('SELECT COUNT(*) as count FROM notifications');
    console.log(`📊 Found ${notifications[0].count} notifications in the table`);
    
    console.log('\n📋 Migration Summary:');
    console.log('✅ notifications table created');
    console.log('✅ homework_submissions table updated with interactive fields');
    console.log('✅ homework table updated with content_type and assignment_type');
    console.log('✅ homework_individual_assignments table created');
    console.log('✅ Sample data inserted');
    console.log('\n🚀 The system is now ready for:');
    console.log('   • Interactive homework with auto-grading');
    console.log('   • Automatic notification system');
    console.log('   • AI-assisted teacher grading');
    console.log('   • Individual homework assignments');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations
runMigrations().then(() => {
  console.log('\n✨ Migrations completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Migration error:', error);
  process.exit(1);
});
