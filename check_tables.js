import { initDatabase, query, close } from './src/db.js';

async function checkTables() {
  try {
    // Initialize database
    const connected = await initDatabase();
    if (!connected) {
      console.log('❌ Failed to connect to database');
      return;
    }

    console.log('\n🔍 Checking all tables in database...');
    
    // Show all tables
    const tables = await query('SHOW TABLES');
    console.log('\n📋 All tables:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`  - ${tableName}`);
    });

    // Check if homework_individual_assignments table exists
    const homeworkIndividualExists = tables.some(table => 
      Object.values(table)[0] === 'homework_individual_assignments'
    );

    console.log('\n🎯 Individual assignments table check:');
    console.log(`  homework_individual_assignments: ${homeworkIndividualExists ? '✅ EXISTS' : '❌ MISSING'}`);

    if (homeworkIndividualExists) {
      console.log('\n📊 Structure of homework_individual_assignments table:');
      const structure = await query('DESCRIBE homework_individual_assignments');
      console.table(structure);
    }

    // Check homework table structure
    console.log('\n📊 Structure of homework table:');
    const homeworkStructure = await query('DESCRIBE homework');
    console.table(homeworkStructure);

    // Check for homework with null class_id
    console.log('\n🔍 Checking homework with null class_id:');
    const nullClassHomework = await query(`
      SELECT id, title, assignment_type, class_id, created_at 
      FROM homework 
      WHERE class_id IS NULL 
      ORDER BY created_at DESC
    `);
    
    if (nullClassHomework.length > 0) {
      console.log(`\n❌ Found ${nullClassHomework.length} homework entries with null class_id:`);
      console.table(nullClassHomework);
    } else {
      console.log('\n✅ No homework entries with null class_id found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await close();
  }
}

checkTables();
