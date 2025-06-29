import { query } from './src/db.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const createBackup = async () => {
  try {
    console.log('🔄 Starting database backup...');
    
    // Create backup directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = `./database_backups/backup_${timestamp}`;
    
    if (!fs.existsSync('./database_backups')) {
      fs.mkdirSync('./database_backups');
    }
    fs.mkdirSync(backupDir);
    
    console.log(`📁 Created backup directory: ${backupDir}`);
    
    // Tables to backup
    const tables = [
      'users',
      'staff', 
      'children',
      'homework',
      'homework_submissions',
      'classes',
      'attendance',
      'messages',
      'groups',
      'group_members',
      'fcm_tokens',
      'push_subscriptions'
    ];
    
    const backupData = {};
    
    for (const table of tables) {
      try {
        console.log(`📊 Backing up table: ${table}`);
        // Use backticks for table names to handle reserved keywords
        const data = await query(`SELECT * FROM \`${table}\``, [], 'skydek_DB');
        backupData[table] = data;
        
        // Also save individual table files
        fs.writeFileSync(
          path.join(backupDir, `${table}.json`),
          JSON.stringify(data, null, 2)
        );
        
        console.log(`✅ Backed up ${data.length} records from ${table}`);
      } catch (error) {
        console.log(`⚠️  Warning: Could not backup table ${table}: ${error.message}`);
        backupData[table] = [];
      }
    }
    
    // Save combined backup file
    fs.writeFileSync(
      path.join(backupDir, 'complete_backup.json'),
      JSON.stringify(backupData, null, 2)
    );
    
    // Create backup metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      database: 'skydek_DB',
      tables: Object.keys(backupData),
      recordCounts: Object.fromEntries(
        Object.entries(backupData).map(([table, data]) => [table, data.length])
      ),
      totalRecords: Object.values(backupData).reduce((sum, data) => sum + data.length, 0)
    };
    
    fs.writeFileSync(
      path.join(backupDir, 'backup_metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    console.log('\n🎉 Database backup completed successfully!');
    console.log('='.repeat(50));
    console.log(`📁 Backup location: ${backupDir}`);
    console.log(`📊 Total tables backed up: ${metadata.tables.length}`);
    console.log(`📈 Total records backed up: ${metadata.totalRecords}`);
    console.log('\n📋 Table breakdown:');
    
    Object.entries(metadata.recordCounts).forEach(([table, count]) => {
      console.log(`   ${table}: ${count} records`);
    });
    
    console.log('\n📄 Files created:');
    console.log(`   - complete_backup.json (all data)`);
    console.log(`   - backup_metadata.json (backup info)`);
    metadata.tables.forEach(table => {
      console.log(`   - ${table}.json (${metadata.recordCounts[table]} records)`);
    });
    
    return backupDir;
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
};

// Run backup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createBackup()
    .then((backupDir) => {
      console.log(`\n✅ Backup completed successfully at: ${backupDir}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Backup failed:', error);
      process.exit(1);
    });
}

export default createBackup; 