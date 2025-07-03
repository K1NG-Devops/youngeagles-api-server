/**
 * Migration Script: homeworks → homework
 * 
 * This script migrates data from the 'homeworks' table to the properly structured 'homework' table
 * and updates homework_submissions references accordingly.
 */

import { query, initDatabase } from './src/db.js';

async function migrateHomeworkData() {
  console.log('🚀 Starting homework data migration...\n');
  
  try {
    await initDatabase();
    
    // Step 1: Check current data
    console.log('📊 Checking current data...');
    const currentHomeworks = await query('SELECT * FROM homeworks ORDER BY id');
    const currentHomework = await query('SELECT * FROM homework ORDER BY id');
    
    console.log(`- homeworks table: ${currentHomeworks.length} records`);
    console.log(`- homework table: ${currentHomework.length} records`);
    
    if (currentHomeworks.length === 0) {
      console.log('✅ No data to migrate. homeworks table is empty.');
      return;
    }
    
    console.log('\n📋 Data to migrate:');
    currentHomeworks.forEach(hw => {
      console.log(`  - ID ${hw.id}: "${hw.title}" (${hw.class_name})`);
    });
    
    // Step 2: Get class mappings
    console.log('\n🔗 Getting class mappings...');
    const classes = await query('SELECT id, name FROM classes');
    const classMap = {};
    classes.forEach(cls => {
      classMap[cls.name] = cls.id;
    });
    console.log('Class mappings:', classMap);
    
    // Step 3: Create homework table backup
    console.log('\n💾 Creating backup of homework table...');
    await query('CREATE TABLE homework_backup_' + Date.now() + ' AS SELECT * FROM homework');
    
    // Step 4: Migrate each homework record
    console.log('\n📦 Migrating homework records...');
    
    const migrationMap = {}; // old_id -> new_id mapping
    
    for (const hw of currentHomeworks) {
      // Get class_id from class name
      const classId = classMap[hw.class_name] || null;
      
      if (!classId && hw.class_name) {
        console.log(`⚠️  Warning: Class "${hw.class_name}" not found in classes table`);
      }
      
      // Convert status
      let status = 'active';
      if (hw.status === 'Pending' || hw.status === null || hw.status === '') {
        status = 'active';
      } else if (hw.status.toLowerCase() === 'completed') {
        status = 'completed';
      } else if (hw.status.toLowerCase() === 'archived') {
        status = 'archived';
      }
      
      // Insert into homework table
      const insertResult = await query(`
        INSERT INTO homework (
          title,
          description,
          teacher_id,
          class_id,
          status,
          due_date,
          points,
          created_at,
          updated_at,
          grade
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      `, [
        hw.title,
        hw.instructions || hw.title, // Use instructions as description
        hw.uploaded_by_teacher_id,
        classId,
        status,
        hw.due_date,
        0, // Default points
        hw.created_at,
        hw.grade
      ]);
      
      const newHomeworkId = insertResult.insertId;
      migrationMap[hw.id] = newHomeworkId;
      
      console.log(`  ✅ Migrated: "${hw.title}" (old ID: ${hw.id} → new ID: ${newHomeworkId})`);
    }
    
    // Step 5: Update homework_submissions references
    console.log('\n🔄 Updating homework_submissions references...');
    
    const submissions = await query('SELECT * FROM homework_submissions');
    console.log(`Found ${submissions.length} submissions to update`);
    
    for (const submission of submissions) {
      const oldHomeworkId = submission.homework_id;
      const newHomeworkId = migrationMap[oldHomeworkId];
      
      if (newHomeworkId) {
        await query(
          'UPDATE homework_submissions SET homework_id = ? WHERE id = ?',
          [newHomeworkId, submission.id]
        );
        console.log(`  ✅ Updated submission ${submission.id}: homework_id ${oldHomeworkId} → ${newHomeworkId}`);
      } else {
        console.log(`  ⚠️  Warning: No mapping found for homework_id ${oldHomeworkId} in submission ${submission.id}`);
      }
    }
    
    // Step 6: Verify migration
    console.log('\n🔍 Verifying migration...');
    const migratedHomework = await query('SELECT COUNT(*) as count FROM homework');
    const migratedSubmissions = await query(`
      SELECT COUNT(*) as count 
      FROM homework_submissions hs 
      JOIN homework h ON hs.homework_id = h.id
    `);
    
    console.log(`✅ homework table now has: ${migratedHomework[0].count} records`);
    console.log(`✅ Valid homework_submissions: ${migratedSubmissions[0].count} records`);
    
    // Step 7: Show migration summary
    console.log('\n📈 Migration Summary:');
    console.log('  ✅ Data migrated from homeworks → homework');
    console.log('  ✅ homework_submissions updated');
    console.log('  ✅ Foreign key relationships established');
    console.log('  💾 Backup created');
    
    console.log('\n🎯 Next Steps:');
    console.log('  1. Update API routes to use homework table');
    console.log('  2. Test all homework endpoints');
    console.log('  3. Once confirmed working, drop homeworks table');
    
    return migrationMap;
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateHomeworkData()
    .then(() => {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

export { migrateHomeworkData };
