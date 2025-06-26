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
    const migrationPath = path.join(__dirname, 'src', 'migrations', 'add_staff_fields.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔧 Running migration to add professional fields to staff table...');
    
    // Split migration into individual statements
    const statements = migration.split(';').filter(stmt => stmt.trim());
    
    // Execute each statement
    for (const stmt of statements) {
      if (stmt.trim()) {
        await connection.query(stmt + ';');
      }
    }
    
    console.log('✅ Migration completed successfully');

    // Verify columns were added
    const [columns] = await connection.query('DESCRIBE staff');
    console.log('\n📋 Staff table structure:');
    columns.forEach(col => {
      console.log(`- ${col.Field} (${col.Type})`);
    });

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