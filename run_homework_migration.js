import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
  host: 'shuttle.proxy.rlwy.net',
  port: 49263,
  user: 'root',
  password: 'fhdgRvbocRQKcikxGTNsQUHVIMizngLb',
  database: 'skydek_DB',
  ssl: {
    rejectUnauthorized: false
  }
};

async function runMigration() {
  let connection;
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully');

    // Read migration file
    const migrationPath = path.join(__dirname, 'src', 'migrations', 'create_homework_tables.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔧 Running migration to create homework tables...');
    
    // Split migration into individual statements
    const statements = migration.split(';').filter(stmt => stmt.trim());
    
    // Execute each statement
    for (const stmt of statements) {
      if (stmt.trim()) {
        await connection.query(stmt + ';');
      }
    }
    
    console.log('✅ Migration completed successfully');

    // Verify tables were created
    const [tables] = await connection.query('SHOW TABLES');
    console.log('\n📋 Database tables:');
    tables.forEach(table => {
      console.log(`- ${Object.values(table)[0]}`);
    });

    // Add some sample homework data for testing
    console.log('\n📚 Adding sample homework data...');
    
    // Get first teacher ID
    const [teachers] = await connection.query('SELECT id FROM staff WHERE role = "teacher" LIMIT 1');
    if (teachers.length > 0) {
      const teacherId = teachers[0].id;
      
      // Add sample homework
      await connection.query(`
        INSERT INTO homework (title, description, teacher_id, status, due_date, points)
        VALUES 
        ('Math Practice #1', 'Complete exercises 1-10', ?, 'active', DATE_ADD(NOW(), INTERVAL 7 DAY), 100),
        ('Reading Assignment', 'Read chapter 3 and answer questions', ?, 'active', DATE_ADD(NOW(), INTERVAL 5 DAY), 50),
        ('Science Project', 'Build a simple machine', ?, 'draft', DATE_ADD(NOW(), INTERVAL 14 DAY), 150)
      `, [teacherId, teacherId, teacherId]);
      
      console.log('✅ Sample homework added successfully');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.sqlMessage) {
      console.error('SQL Error:', error.sqlMessage);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

runMigration(); 