import { execute } from '../db.js';

export async function addProfilePictureSupport() {
  console.log('🔄 Adding profile picture support to database...');
  
  try {
    // Check and add profile_picture column to users table
    const usersColumnCheck = await execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'profile_picture'
    `);
    
    if (usersColumnCheck[0].count === 0) {
      await execute(`
        ALTER TABLE users 
        ADD COLUMN profile_picture VARCHAR(255) DEFAULT NULL
      `);
      console.log('✅ Added profile_picture column to users table');
    } else {
      console.log('ℹ️ profile_picture column already exists in users table');
    }

    // Check and add profile_picture column to staff table
    const staffColumnCheck = await execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'staff' 
      AND COLUMN_NAME = 'profile_picture'
    `);
    
    if (staffColumnCheck[0].count === 0) {
      await execute(`
        ALTER TABLE staff 
        ADD COLUMN profile_picture VARCHAR(255) DEFAULT NULL
      `);
      console.log('✅ Added profile_picture column to staff table');
    } else {
      console.log('ℹ️ profile_picture column already exists in staff table');
    }

    // Add indexes for better performance
    try {
      const usersIndexCheck = await execute(`
        SELECT COUNT(*) as count 
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND INDEX_NAME = 'idx_users_profile_picture'
      `);
      
      if (usersIndexCheck[0].count === 0) {
        await execute(`
          CREATE INDEX idx_users_profile_picture ON users(profile_picture(255))
        `);
        console.log('✅ Added index for users.profile_picture');
      } else {
        console.log('ℹ️ Index for users.profile_picture already exists');
      }
    } catch (error) {
      console.log('ℹ️ Could not create index for users.profile_picture:', error.message);
    }

    try {
      const staffIndexCheck = await execute(`
        SELECT COUNT(*) as count 
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'staff' 
        AND INDEX_NAME = 'idx_staff_profile_picture'
      `);
      
      if (staffIndexCheck[0].count === 0) {
        await execute(`
          CREATE INDEX idx_staff_profile_picture ON staff(profile_picture(255))
        `);
        console.log('✅ Added index for staff.profile_picture');
      } else {
        console.log('ℹ️ Index for staff.profile_picture already exists');
      }
    } catch (error) {
      console.log('ℹ️ Could not create index for staff.profile_picture:', error.message);
    }

    console.log('✅ Profile picture support migration completed successfully');
    return { success: true, message: 'Profile picture support added successfully' };

  } catch (error) {
    console.error('❌ Error adding profile picture support:', error);
    return { success: false, error: error.message };
  }
}
