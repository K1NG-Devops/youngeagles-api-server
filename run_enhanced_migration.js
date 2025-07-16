#!/usr/bin/env node

// Script to run the enhanced homework migration
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Running Enhanced Homework Migration...');
console.log('');

try {
  // Navigate to the API directory and run migrations
  const apiPath = path.join(__dirname);
  
  console.log('📁 Current directory:', apiPath);
  console.log('');
  
  // Run the migration
  console.log('🔄 Running database migrations...');
  execSync('node src/migrations/run-migrations.js', { 
    cwd: apiPath,
    stdio: 'inherit' 
  });
  
  console.log('');
  console.log('✅ Enhanced homework migration completed successfully!');
  console.log('');
  console.log('🎉 Your homework system now supports:');
  console.log('   📋 Learning objectives');
  console.log('   ✅ Activity lists');
  console.log('   🎒 Material requirements');
  console.log('   👨‍👩‍👧‍👦 Parent guidance');
  console.log('   🎯 CAPS alignment');
  console.log('   ⏱️ Duration tracking');
  console.log('   📊 Difficulty levels');
  console.log('   📅 Term tracking');
  console.log('');
  console.log('🔄 Please restart your API server to apply the changes');
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error('');
  console.error('🔧 Troubleshooting:');
  console.error('   1. Check your database connection in .env');
  console.error('   2. Ensure the homework table exists');
  console.error('   3. Check database permissions');
  console.error('   4. Review the migration SQL file');
  process.exit(1);
}
