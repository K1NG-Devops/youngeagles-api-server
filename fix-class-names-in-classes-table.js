import { query } from './src/db.js';

async function fixClassNamesInClassesTable() {
  try {
    console.log('Starting class name fix in classes table...');
    
    // Update "Panda Class" to "Panda" in classes table
    const result = await query(
      'UPDATE classes SET name = ? WHERE name = ?',
      ['Panda', 'Panda Class'],
      'skydek_DB'
    );

    console.log(`✅ Updated class name in classes table`);
    
    // Verify the changes
    const classes = await query(
      'SELECT id, name, description, age_group_min, age_group_max, capacity FROM classes',
      [],
      'skydek_DB'
    );

    console.log('\nCurrent classes in database:');
    classes.forEach(cls => {
      console.log(`- ${cls.name} (Ages ${cls.age_group_min}-${cls.age_group_max}): ${cls.description}`);
    });

  } catch (error) {
    console.error('Error fixing class names in classes table:', error);
  }
}

fixClassNamesInClassesTable(); 