#!/usr/bin/env node

import { query } from './src/db.js';
import fs from 'fs';
import path from 'path';

async function cleanupOrphanedProfilePictures() {
    console.log('🔍 Starting cleanup of orphaned profile picture references...');
    
    try {
        // Get all users with profile pictures
        const usersWithProfilePictures = await query(`
            SELECT id, name, email, profile_picture, 'parent' as user_type 
            FROM users 
            WHERE profile_picture IS NOT NULL AND profile_picture != ''
            UNION ALL
            SELECT id, name, email, profile_picture, role as user_type 
            FROM staff 
            WHERE profile_picture IS NOT NULL AND profile_picture != ''
        `);
        
        console.log(`📊 Found ${usersWithProfilePictures.length} users with profile pictures`);
        
        let orphanedCount = 0;
        let fixedCount = 0;
        
        for (const user of usersWithProfilePictures) {
            const profilePicturePath = user.profile_picture;
            
            if (!profilePicturePath || !profilePicturePath.startsWith('/uploads/profile_pictures/')) {
                continue;
            }
            
            // Convert to actual file path
            const actualFilePath = path.join(process.cwd(), profilePicturePath.substring(1)); // Remove leading slash
            
            // Check if file exists
            if (!fs.existsSync(actualFilePath)) {
                console.log(`❌ Missing file for user ${user.name} (${user.email}): ${profilePicturePath}`);
                orphanedCount++;
                
                // Clear the profile picture reference
                if (user.user_type === 'parent') {
                    await query('UPDATE users SET profile_picture = NULL WHERE id = ?', [user.id]);
                } else {
                    await query('UPDATE staff SET profile_picture = NULL WHERE id = ?', [user.id]);
                }
                
                fixedCount++;
                console.log(`✅ Cleared orphaned reference for user ${user.name}`);
            } else {
                console.log(`✅ Valid file for user ${user.name}: ${profilePicturePath}`);
            }
        }
        
        console.log(`\n📈 Summary:`);
        console.log(`   - Total users with profile pictures: ${usersWithProfilePictures.length}`);
        console.log(`   - Orphaned references found: ${orphanedCount}`);
        console.log(`   - References fixed: ${fixedCount}`);
        console.log(`\n✨ Cleanup complete!`);
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

// Run the cleanup
cleanupOrphanedProfilePictures().then(() => {
    console.log('🎉 Profile picture cleanup finished!');
    process.exit(0);
}).catch(error => {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
});
