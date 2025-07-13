import { execute } from '../db.js';

export async function addProfilePictureSupport() {
  console.log('🔄 Adding profile picture support to database...');
  
  try {
    // Add profile_picture column to users table
    await execute(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(255) DEFAULT NULL
    `);
    console.log('✅ Added profile_picture column to users table');

    // Add profile_picture column to staff table  
    await execute(`
      ALTER TABLE staff 
      ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(255) DEFAULT NULL
    `);
    console.log('✅ Added profile_picture column to staff table');

    // Add indexes for better performance
    try {
      await execute(`
        CREATE INDEX IF NOT EXISTS idx_users_profile_picture ON users(profile_picture)
      `);
      console.log('✅ Added index for users.profile_picture');
    } catch (error) {
      console.log('ℹ️ Index for users.profile_picture may already exist');
    }

    try {
      await execute(`
        CREATE INDEX IF NOT EXISTS idx_staff_profile_picture ON staff(profile_picture)
      `);
      console.log('✅ Added index for staff.profile_picture');
    } catch (error) {
      console.log('ℹ️ Index for staff.profile_picture may already exist');
    }

    console.log('✅ Profile picture support migration completed successfully');
    return { success: true, message: 'Profile picture support added successfully' };

  } catch (error) {
    console.error('❌ Error adding profile picture support:', error);
    return { success: false, error: error.message };
  }
}
