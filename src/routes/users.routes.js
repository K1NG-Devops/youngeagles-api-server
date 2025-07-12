import express from 'express';
import authenticateToken from '../middleware/authMiddleware.js';
import { db } from '../db.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

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
        cb(null, `profile-${req.user.id}-${uniqueSuffix}${ext}`);
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
    const [rows] = await db.execute(sql, params);
    return rows;
}

// Get all users (admin only)
router.get('/', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can access all users'
            });
        }

        // Get all users from both users and staff tables
        const [parents, teachers] = await Promise.all([
            executeQuery(`
                SELECT 
                    id,
                    name,
                    email,
                    'parent' as role,
                    created_at,
                    updated_at
                FROM users
                ORDER BY created_at DESC
            `),
            executeQuery(`
                SELECT 
                    id,
                    name,
                    email,
                    role,
                    created_at,
                    updated_at
                FROM staff
                ORDER BY created_at DESC
            `)
        ]);

        // Combine both arrays
        const allUsers = [...parents, ...teachers];

        res.json({
            success: true,
            users: allUsers
        });

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: error.message
        });
    }
});

// Get user by ID (admin only)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can access user details'
            });
        }

        const { id } = req.params;

        // Try to find in users table first (parents)
        let user = await executeQuery(`
            SELECT 
                id,
                name,
                email,
                'parent' as role,
                created_at,
                updated_at
            FROM users
            WHERE id = ?
        `, [id]);

        // If not found in users, try staff table
        if (user.length === 0) {
            user = await executeQuery(`
                SELECT 
                    id,
                    name,
                    email,
                    role,
                    created_at,
                    updated_at
                FROM staff
                WHERE id = ?
            `, [id]);
        }

        if (user.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: user[0]
        });

    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user',
            error: error.message
        });
    }
});

// Upload profile picture
router.post('/profile-picture', authenticateToken, upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: 'No file uploaded' 
            });
        }

        const userId = req.user.id;
        const userType = req.user.userType;
        const filePath = `/uploads/profile_pictures/${req.file.filename}`;

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

// Get current user profile (for profile refresh)
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userType = req.user.userType;

        let user;
        if (userType === 'parent') {
            const [parentUser] = await executeQuery(
                'SELECT id, name, email, phone, address, profile_picture, created_at, updated_at FROM users WHERE id = ?',
                [userId]
            );
            user = parentUser;
        } else if (userType === 'teacher' || userType === 'admin') {
            const [staffUser] = await executeQuery(
                'SELECT id, name, email, role, profile_picture, created_at, updated_at FROM staff WHERE id = ?',
                [userId]
            );
            user = staffUser;
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Normalize profile picture fields
        const normalizedUser = {
            ...user,
            profilePicture: user.profile_picture,
            profile_picture: user.profile_picture,
            avatar: user.profile_picture,
            image: user.profile_picture,
            userType: userType
        };

        res.json({
            success: true,
            user: normalizedUser
        });

    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user profile',
            message: error.message
        });
    }
});

// Check database schema for profile picture support
router.get('/check-profile-picture-support', authenticateToken, async (req, res) => {
    try {
        // Check if profile_picture column exists in users table
        const usersColumnCheck = await executeQuery(`
            SELECT COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'profile_picture'
        `);

        // Check if profile_picture column exists in staff table
        const staffColumnCheck = await executeQuery(`
            SELECT COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'staff' 
            AND COLUMN_NAME = 'profile_picture'
        `);

        const hasUsersColumn = usersColumnCheck.length > 0;
        const hasStaffColumn = staffColumnCheck.length > 0;

        res.json({
            success: true,
            profilePictureSupport: {
                usersTable: hasUsersColumn,
                staffTable: hasStaffColumn,
                fullySupported: hasUsersColumn && hasStaffColumn,
                migrationNeeded: !hasUsersColumn || !hasStaffColumn
            },
            message: hasUsersColumn && hasStaffColumn 
                ? 'Profile picture feature is fully supported' 
                : 'Database migration needed for profile picture support'
        });

    } catch (error) {
        console.error('Error checking profile picture support:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check profile picture support',
            error: error.message
        });
    }
});

// Get user statistics (admin only)
router.get('/stats/overview', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can access user statistics'
            });
        }

        // Get counts from different tables
        const [parentCount] = await executeQuery('SELECT COUNT(*) as count FROM users');
        const [teacherCount] = await executeQuery('SELECT COUNT(*) as count FROM staff WHERE role = "teacher"');
        const [adminCount] = await executeQuery('SELECT COUNT(*) as count FROM staff WHERE role = "admin"');
        const [childrenCount] = await executeQuery('SELECT COUNT(*) as count FROM children');
        
        // Get pending approvals count
        let pendingApprovals = 0;
        try {
            const [pendingPayments] = await executeQuery('SELECT COUNT(*) as count FROM payment_proofs WHERE status = "pending"');
            pendingApprovals = pendingPayments.count;
        } catch (error) {
            console.log('payment_proofs table not found, checking payments table');
            try {
                const [pendingPayments] = await executeQuery('SELECT COUNT(*) as count FROM payments WHERE status = "pending"');
                pendingApprovals = pendingPayments.count;
            } catch (error) {
                console.log('No pending payments found');
            }
        }

        const stats = {
            totalUsers: parentCount.count + teacherCount.count + adminCount.count,
            totalParents: parentCount.count,
            totalTeachers: teacherCount.count,
            totalAdmins: adminCount.count,
            totalChildren: childrenCount.count,
            pendingApprovals: pendingApprovals
        };

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('Error fetching user statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user statistics',
            error: error.message
        });
    }
});

export default router;
