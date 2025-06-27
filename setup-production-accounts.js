import crypto from 'crypto';
import { query, execute } from './src/db.js';
import dotenv from 'dotenv';

dotenv.config();

// Use the same password hashing method as the API (PBKDF2)
function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const setupProductionAccounts = async () => {
  try {
    console.log('🚀 Setting up production accounts with correct password hashing...\n');
    
    const accounts = [
      {
        name: 'Admin User',
        email: 'admin@youngeagles.org.za',
        password: '#Admin@2012',
        role: 'admin',
        table: 'staff'
      },
      {
        name: 'Test Teacher',
        email: 'test.teacher@youngeagles.org.za',
        password: 'Test@123',
        role: 'teacher',
        table: 'staff',
        className: 'Panda Class'
      },
      {
        name: 'Teacher Demo',
        email: 'teacher@youngeagles.org.za',
        password: 'Teacher@123',
        role: 'teacher',
        table: 'staff',
        className: 'Lion Class'
      },
      {
        name: 'Test Parent',
        email: 'test.parent@youngeagles.org.za',
        password: 'Parent@123',
        role: 'parent',
        table: 'users',
        address: 'Test Address, Johannesburg'
      }
    ];

    for (const account of accounts) {
      console.log(`🔧 Processing ${account.role}: ${account.email}`);
      
      // Hash password using PBKDF2 (same as API)
      const hashedPassword = hashPassword(account.password);
      
      if (account.table === 'staff') {
        // Check if account exists in staff table
        const existing = await query(
          'SELECT id FROM staff WHERE email = ? AND role = ?',
          [account.email, account.role],
          'skydek_DB'
        );

        if (existing.length > 0) {
          console.log(`   ⚠️  Account exists. Updating password...`);
          
          const updateFields = ['name = ?', 'password = ?', 'is_verified = TRUE', 'updated_at = NOW()'];
          const updateValues = [account.name, hashedPassword];
          
          if (account.className) {
            updateFields.push('className = ?');
            updateValues.push(account.className);
          }
          
          updateValues.push(account.email, account.role);
          
          await execute(
            `UPDATE staff SET ${updateFields.join(', ')} WHERE email = ? AND role = ?`,
            updateValues,
            'skydek_DB'
          );
          
          console.log(`   ✅ Account updated successfully!`);
        } else {
          console.log(`   ➕ Creating new account...`);
          
          const insertFields = ['name', 'email', 'password', 'role', 'is_verified'];
          const insertValues = [account.name, account.email, hashedPassword, account.role, true];
          
          if (account.className) {
            insertFields.push('className');
            insertValues.push(account.className);
          }
          
          await execute(
            `INSERT INTO staff (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`,
            insertValues,
            'skydek_DB'
          );
          
          console.log(`   ✅ Account created successfully!`);
        }
      } else if (account.table === 'users') {
        // Check if account exists in users table
        const existing = await query(
          'SELECT id FROM users WHERE email = ? AND role = ?',
          [account.email, account.role],
          'skydek_DB'
        );

        if (existing.length > 0) {
          console.log(`   ⚠️  Account exists. Updating password...`);
          
          await execute(
            'UPDATE users SET name = ?, password = ?, address = ?, updated_at = NOW() WHERE email = ? AND role = ?',
            [account.name, hashedPassword, account.address || '', account.email, account.role],
            'skydek_DB'
          );
          
          console.log(`   ✅ Account updated successfully!`);
        } else {
          console.log(`   ➕ Creating new account...`);
          
          await execute(
            'INSERT INTO users (name, email, password, role, address) VALUES (?, ?, ?, ?, ?)',
            [account.name, account.email, hashedPassword, account.role, account.address || ''],
            'skydek_DB'
          );
          
          console.log(`   ✅ Account created successfully!`);
        }
      }
    }

    // Verify all accounts
    console.log('\n🔍 Verifying created accounts...');
    
    const staffAccounts = await query(
      'SELECT id, name, email, role, className, is_verified, updated_at FROM staff WHERE email IN (?, ?, ?)',
      ['admin@youngeagles.org.za', 'test.teacher@youngeagles.org.za', 'teacher@youngeagles.org.za'],
      'skydek_DB'
    );
    
    const userAccounts = await query(
      'SELECT id, name, email, role, address, created_at FROM users WHERE email IN (?)',
      ['test.parent@youngeagles.org.za'],
      'skydek_DB'
    );

    console.log('\n🎉 Production accounts setup complete!');
    console.log('='.repeat(60));
    console.log('📊 STAFF ACCOUNTS:');
    staffAccounts.forEach(account => {
      console.log(`   ${account.role.toUpperCase()}: ${account.email}`);
      console.log(`   Name: ${account.name}`);
      if (account.className) console.log(`   Class: ${account.className}`);
      console.log(`   Verified: ${account.is_verified ? 'Yes' : 'No'}`);
      console.log(`   Updated: ${account.updated_at}`);
      console.log('');
    });
    
    console.log('👥 USER ACCOUNTS:');
    userAccounts.forEach(account => {
      console.log(`   ${account.role.toUpperCase()}: ${account.email}`);
      console.log(`   Name: ${account.name}`);
      console.log(`   Address: ${account.address}`);
      console.log('');
    });
    
    console.log('🔑 LOGIN CREDENTIALS:');
    console.log('   Admin: admin@youngeagles.org.za / #Admin@2012');
    console.log('   Test Teacher: test.teacher@youngeagles.org.za / Test@123');
    console.log('   Teacher Demo: teacher@youngeagles.org.za / Teacher@123');
    console.log('   Test Parent: test.parent@youngeagles.org.za / Parent@123');
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up production accounts:', error);
    process.exit(1);
  }
};

// Run the setup
setupProductionAccounts(); 