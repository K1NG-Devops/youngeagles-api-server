import bcrypt from 'bcryptjs';
import { query, execute } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const setupParentPasswords = async () => {
  try {
    console.log('🔧 Setting up parent passwords...');
    
    // Get all parents from skydek_DB database
    const parents = await query(
      'SELECT id, name, email FROM users WHERE role = "parent"',
      [],
      'skydek_DB'
    );
    
    console.log(`Found ${parents.length} parents:`);
    parents.forEach(parent => {
      console.log(`- ${parent.name} (${parent.email})`);
    });
    
    // Default password for all parents
    const defaultPassword = 'parent123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);
    
    console.log('\n🔑 Setting default password: parent123');
    
    // Update password for each parent
    for (const parent of parents) {
      await execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, parent.id],
        'skydek_DB'
      );
      console.log(`✅ Updated password for ${parent.name}`);
    }
    
    console.log('\n✨ All parent passwords have been set!');
    console.log('Parents can now log in with:');
    console.log('Password: parent123');
    
    console.log('\n🎉 Setup complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error setting up parent passwords:', error);
    process.exit(1);
  }
};

setupParentPasswords(); 