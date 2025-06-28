import { query } from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration(sql) {
  try {
    // Split the SQL file into individual statements
    const statements = sql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);

    // Execute each statement
    for (const statement of statements) {
      await query(statement + ';');
      console.log('✅ Executed SQL:', statement.substring(0, 50) + '...');
    }
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
}

async function runMigrations() {
  console.log('🚀 Running database migrations...');

  // Read and execute create_messages_table.sql
  const messagesTablePath = path.join(__dirname, '../migrations/create_messages_table.sql');
  if (fs.existsSync(messagesTablePath)) {
    const messagesTableSql = fs.readFileSync(messagesTablePath, 'utf8');
    console.log('📦 Creating messages table...');
    const messagesResult = await runMigration(messagesTableSql);
    if (!messagesResult) {
      console.error('❌ Failed to create messages table');
      process.exit(1);
    }
    console.log('✅ Messages table created successfully');
  }

  console.log('✨ All migrations completed successfully');
  process.exit(0);
}

// Run migrations
runMigrations().catch(error => {
  console.error('❌ Migration script failed:', error);
  process.exit(1);
}); 