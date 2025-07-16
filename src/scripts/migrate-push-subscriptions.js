#!/usr/bin/env node

import { query } from '../db.js';
import fs from 'fs';
import path from 'path';

async function runPushSubscriptionsMigration() {
  console.log('🚀 Starting push_subscriptions table migration...');
  
  try {
    // Read the SQL migration file
    const sqlFilePath = path.join(process.cwd(), 'src/migrations/create_push_subscriptions_table.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Split SQL statements by semicolon and execute each
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.includes('CREATE TABLE')) {
        console.log('📦 Creating push_subscriptions table...');
        await query(statement);
        console.log('✅ Table created successfully');
      } else if (statement.includes('INSERT INTO migrations')) {
        console.log('📝 Recording migration...');
        await query(statement);
        console.log('✅ Migration recorded');
      } else if (statement.includes('SELECT')) {
        const result = await query(statement);
        console.log('✅', result[0]?.status || 'Migration completed');
      }
    }
    
    console.log('🎉 Push subscriptions migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    // If table already exists, that's okay
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('ℹ️  Table already exists, skipping creation');
      return;
    }
    
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPushSubscriptionsMigration()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default runPushSubscriptionsMigration;
