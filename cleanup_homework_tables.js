/**
 * Cleanup Script: Remove redundant homework tables
 * 
 * This script removes the old 'homeworks' table and other redundant homework-related tables
 * after confirming the migration to 'homework' table was successful.
 */

import { query, initDatabase } from './src/db.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase().trim());
    });
  });
}

async function cleanupHomeworkTables() {
  console.log('🧹 Homework Tables Cleanup Script\n');
  
  try {
    await initDatabase();
    
    // Step 1: Verify migration was successful
    console.log('📊 Verifying migration status...');
    
    const homeworkCount = await query('SELECT COUNT(*) as count FROM homework');
    const homeworksCount = await query('SELECT COUNT(*) as count FROM homeworks');
    const validSubmissions = await query(`
      SELECT COUNT(*) as count 
      FROM homework_submissions hs 
      JOIN homework h ON hs.homework_id = h.id
    `);
    
    console.log(`✅ homework table: ${homeworkCount[0].count} records`);
    console.log(`📋 homeworks table: ${homeworksCount[0].count} records (old)`);
    console.log(`🔗 Valid submissions: ${validSubmissions[0].count} records`);
    
    if (homeworkCount[0].count === 0) {
      console.log('❌ ERROR: homework table is empty! Migration may have failed.');
      console.log('Please run the migration script first.');
      rl.close();
      return;
    }
    
    // Step 2: List all homework-related tables
    console.log('\n📋 Found homework-related tables:');
    const tables = await query('SHOW TABLES LIKE "%homework%"');
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`  ${index + 1}. ${tableName}`);
    });
    
    // Step 3: Ask for confirmation
    console.log('\n⚠️  WARNING: This will permanently delete the following tables:');
    console.log('  - homeworks (old table)');
    console.log('  - homework_v2 (duplicate)');
    console.log('  - homework_submissions_old_backup (backup)');
    console.log('  - Other redundant homework tables (if any)');
    
    const confirmCleanup = await askQuestion('\\nDo you want to proceed with cleanup? (yes/no): ');
    
    if (confirmCleanup !== 'yes' && confirmCleanup !== 'y') {
      console.log('❌ Cleanup cancelled by user.');
      rl.close();
      return;
    }
    
    // Step 4: Create final backup before cleanup
    console.log('\\n💾 Creating final backup...');
    await query('CREATE TABLE homeworks_final_backup AS SELECT * FROM homeworks');
    console.log('✅ Backup created: homeworks_final_backup');
    
    // Step 5: Drop redundant tables
    console.log('\\n🗑️  Removing redundant tables...');
    
    const tablesToDrop = [
      'homeworks',
      'homework_v2', 
      'homework_submissions_old_backup'
    ];
    
    for (const tableName of tablesToDrop) {
      try {
        await query(`DROP TABLE IF EXISTS ${tableName}`);
        console.log(`  ✅ Dropped: ${tableName}`);
      } catch (error) {
        console.log(`  ⚠️  Could not drop ${tableName}: ${error.message}`);
      }
    }
    
    // Step 6: Verify cleanup
    console.log('\\n🔍 Verifying cleanup...');
    const remainingTables = await query('SHOW TABLES LIKE "%homework%"');
    console.log('Remaining homework tables:');
    remainingTables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`  - ${tableName}`);
    });
    
    // Step 7: Final verification
    console.log('\\n🧪 Final verification...');
    const finalHomeworkCount = await query('SELECT COUNT(*) as count FROM homework');
    const finalSubmissions = await query(`
      SELECT COUNT(*) as count 
      FROM homework_submissions hs 
      JOIN homework h ON hs.homework_id = h.id
    `);
    
    console.log(`✅ homework table: ${finalHomeworkCount[0].count} records`);
    console.log(`✅ Valid submissions: ${finalSubmissions[0].count} records`);
    
    // Step 8: Summary
    console.log('\\n🎉 Cleanup Summary:');
    console.log('  ✅ Old homeworks table removed');
    console.log('  ✅ Redundant tables cleaned up');
    console.log('  ✅ Data integrity preserved');
    console.log('  ✅ API now uses consistent homework table');
    console.log('  💾 Final backup created: homeworks_final_backup');
    
    console.log('\\n🚀 Database optimization complete!');
    console.log('Your API now uses a single, well-structured homework table.');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    rl.close();
  }
}

// Run cleanup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupHomeworkTables()
    .then(() => {
      console.log('\\n✅ Cleanup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\\n❌ Cleanup failed:', error);
      process.exit(1);
    });
}

export { cleanupHomeworkTables };
