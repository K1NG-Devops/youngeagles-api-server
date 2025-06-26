import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execute } from './src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runProfileDataMigration() {
  try {
    console.log('🚀 Running profile_data migration...');
    
    // Read the migration SQL
    const migrationPath = path.join(__dirname, 'src/migrations/add_profile_data_to_children.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split into individual statements (remove comments and empty lines)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`🔧 Executing statement ${i + 1}:`, statement.substring(0, 100) + '...');
        await execute(statement, [], 'skydek_DB');
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    }
    
    console.log('🎉 Profile data migration completed successfully!');
    
    // Test the new column
    console.log('🧪 Testing new column...');
    const testResult = await execute(
      'DESCRIBE children',
      [],
      'skydek_DB'
    );
    
    const profileDataColumn = testResult.find(col => col.Field === 'profile_data');
    if (profileDataColumn) {
      console.log('✅ profile_data column confirmed:', profileDataColumn);
    } else {
      console.log('❌ profile_data column not found');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runProfileDataMigration()
    .then(() => {
      console.log('✅ Migration process completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Migration process failed:', error);
      process.exit(1);
    });
} 