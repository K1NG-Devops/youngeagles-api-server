import { query } from './src/db.js';

async function checkClasses() {
  try {
    console.log('Checking class names...');
    
    // Get all distinct class names
    const classes = await query(
      'SELECT DISTINCT className FROM children',
      [],
      'skydek_DB'
    );

    console.log('\nAll class names in the database:');
    classes.forEach(cls => {
      console.log(`- ${cls.className}`);
    });

    // Get counts for each class
    const counts = await query(
      'SELECT className, COUNT(*) as count FROM children GROUP BY className',
      [],
      'skydek_DB'
    );

    console.log('\nNumber of children in each class:');
    counts.forEach(cls => {
      console.log(`- ${cls.className}: ${cls.count} children`);
    });

  } catch (error) {
    console.error('Error checking classes:', error);
  }
}

checkClasses(); 