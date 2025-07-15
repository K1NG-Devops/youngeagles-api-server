import express from 'express';
import { query } from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Admin cleanup route for orphaned profile pictures
router.post('/cleanup-profile-pictures', async (req, res) => {
    try {
        console.log('🔍 Starting cleanup of orphaned profile picture references...');
        
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
        const issues = [];
        
        for (const user of usersWithProfilePictures) {
            const profilePicturePath = user.profile_picture;
            
            if (!profilePicturePath || !profilePicturePath.startsWith('/uploads/profile_pictures/')) {
                continue;
            }
            
            // Convert to actual file path
            const actualFilePath = path.join(__dirname, '../..', profilePicturePath.substring(1));
            
            // Check if file exists
            if (!fs.existsSync(actualFilePath)) {
                console.log(`❌ Missing file for user ${user.name} (${user.email}): ${profilePicturePath}`);
                orphanedCount++;
                
                issues.push({
                    user: user.name,
                    email: user.email,
                    missingFile: profilePicturePath,
                    status: 'fixed'
                });
                
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
        
        const summary = {
            totalUsers: usersWithProfilePictures.length,
            orphanedReferences: orphanedCount,
            fixedReferences: fixedCount,
            issues: issues
        };
        
        console.log(`\n📈 Summary:`, summary);
        console.log(`\n✨ Cleanup complete!`);
        
        res.json({
            success: true,
            message: 'Profile picture cleanup completed successfully',
            summary: summary
        });
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cleanup profile pictures',
            error: error.message
        });
    }
});

export default router;
