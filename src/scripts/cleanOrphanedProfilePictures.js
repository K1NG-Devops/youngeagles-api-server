import { db } from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function cleanOrphanedProfilePictures() {
    try {
        console.log('🧹 Starting cleanup of orphaned profile pictures...');

        // Get all users with profile pictures
        const [users] = await db.execute(`
            SELECT id, profile_picture, 'parent' as user_type FROM users WHERE profile_picture IS NOT NULL
            UNION ALL
            SELECT id, profile_picture, 'staff' as user_type FROM staff WHERE profile_picture IS NOT NULL
        `);

        let cleanedCount = 0;
        const defaultAvatar = '/assets/default-avatar.png';

        for (const user of users) {
            if (user.profile_picture && user.profile_picture.startsWith('/uploads/')) {
                const filePath = path.join(__dirname, '../..', user.profile_picture);
                
                // Check if file exists
                if (!fs.existsSync(filePath)) {
                    console.log(`❌ Missing file for user ${user.id}: ${user.profile_picture}`);
                    
                    // Update to default avatar
                    const table = user.user_type === 'parent' ? 'users' : 'staff';
                    await db.execute(
                        `UPDATE ${table} SET profile_picture = ? WHERE id = ?`,
                        [defaultAvatar, user.id]
                    );
                    
                    cleanedCount++;
                    console.log(`✅ Updated user ${user.id} to use default avatar`);
                }
            }
        }

        console.log(`\n✨ Cleanup complete! Updated ${cleanedCount} users to use default avatar.`);

    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        process.exit(0);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    cleanOrphanedProfilePictures();
}

export { cleanOrphanedProfilePictures };
