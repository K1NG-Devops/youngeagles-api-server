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
  },
  multipleStatements: true
};

async function runMigration() {
  let connection;
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully');

    const migrationPath = path.join(__dirname, 'src', 'migrations', 'add_status_to_submissions.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔧 Running migration to add status column to homework_submissions...');
    await connection.query(migrationSql);
    console.log('✅ Migration completed successfully.');

    const [columns] = await connection.query('DESCRIBE homework_submissions;');
    console.log('\n📋 Current `homework_submissions` table structure:');
    columns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

runMigration(); 