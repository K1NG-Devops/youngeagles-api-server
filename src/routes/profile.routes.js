import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { query } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../../uploads/profile_pictures');
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        // Use user id from the authenticated user
        const userId = req.user?.id || 'unknown';
        cb(null, `profile-${userId}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.mimetype)) {
            cb(new Error('Invalid file type. Only JPEG and PNG allowed.'), false);
        } else {
            cb(null, true);
        }
    }
});

// Helper function to execute database queries
async function executeQuery(sql, params = []) {
    const [rows] = await query(sql, params);
    return rows;
}

// Profile picture upload endpoint
router.post('/picture', authenticateToken, upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'avatar', maxCount: 1 },
    { name: 'image', maxCount: 1 }
]), async (req, res) => {
    try {
        // Get the uploaded file from any of the possible field names
        const file = req.files?.profilePicture?.[0] || req.files?.avatar?.[0] || req.files?.image?.[0];
        
        if (!file) {
            return res.status(400).json({ 
                success: false,
                error: 'No file uploaded' 
            });
        }

        const userId = req.user.id;
        const userType = req.user.userType;
        const filePath = `/uploads/profile_pictures/${file.filename}`;

        // Update user's profile picture in appropriate table
        if (userType === 'parent') {
            await executeQuery(
                'UPDATE users SET profile_picture = ?, updated_at = NOW() WHERE id = ?',
                [filePath, userId]
            );
        } else if (userType === 'teacher' || userType === 'admin') {
            await executeQuery(
                'UPDATE staff SET profile_picture = ?, updated_at = NOW() WHERE id = ?',
                [filePath, userId]
            );
        }

        // Get updated user data
        let updatedUser;
        if (userType === 'parent') {
            const [user] = await executeQuery(
                'SELECT id, name, email, profile_picture, updated_at FROM users WHERE id = ?',
                [userId]
            );
            updatedUser = user;
        } else {
            const [user] = await executeQuery(
                'SELECT id, name, email, profile_picture, role, updated_at FROM staff WHERE id = ?',
                [userId]
            );
            updatedUser = user;
        }

        res.json({
            success: true,
            message: 'Profile picture updated successfully',
            data: {
                profilePictureUrl: filePath,
                user: {
                    ...updatedUser,
                    profilePicture: filePath,
                    profile_picture: filePath,
                    avatar: filePath,
                    image: filePath
                }
            }
        });

    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to upload profile picture',
            message: error.message
        });
    }
});

export default router;
