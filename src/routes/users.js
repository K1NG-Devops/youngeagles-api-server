import express from 'express';
import { body, validationResult, param } from 'express-validator';
import { authMiddleware as authenticateUser } from '../middleware/authMiddleware.js';
import { sanitizeInput } from '../middleware/security.js';
import { query } from '../db.js';
const router = express.Router();

// Get user profile
router.get('/profile', authenticateUser, async (req, res) => {
    try {
        const userResult = await query(
            'SELECT id, firebase_uid, name, email, phone, role, created_at, address, workAddress, first_name, last_name, role_id, is_active, email_verified, last_login, reset_token, reset_token_expires, updated_at FROM users WHERE id = ?',
            [req.user.id]
        );
        
        if (userResult.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const user = userResult[0];
        res.json(user);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user profile
router.put('/profile', 
    authenticateUser,
    [
        body('firstName').optional().isLength({ min: 1, max: 50 }).trim(),
        body('lastName').optional().isLength({ min: 1, max: 50 }).trim(),
        body('email').optional().isEmail().normalizeEmail(),
        body('phone').optional().isMobilePhone(),
        sanitizeInput
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const updates = {};
            const allowedUpdates = ['firstName', 'lastName', 'email', 'phone'];
            
            allowedUpdates.forEach(field => {
                if (req.body[field] !== undefined) {
                    updates[field] = req.body[field];
                }
            });

            // Build the SET clause dynamically
            const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
            const values = Object.values(updates);
            values.push(req.user.id); // Add user ID for WHERE clause
            
            if (setClause) {
                await query(
                    `UPDATE users SET ${setClause} WHERE id = ?`,
                    values
                );
            }
            
            // Get updated user data
            const userResult = await query(
                'SELECT id, firebase_uid, name, email, phone, role, created_at, address, workAddress, first_name, last_name, role_id, is_active, email_verified, last_login, reset_token, reset_token_expires, updated_at FROM users WHERE id = ?',
                [req.user.id]
            );
            
            if (userResult.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }
            
            const user = userResult[0];

            res.json(user);
        } catch (error) {
            console.error('Update profile error:', error);
            if (error.code === 11000) {
                return res.status(400).json({ message: 'Email already exists' });
            }
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Delete user account
router.delete('/profile', authenticateUser, async (req, res) => {
    try {
        const deleteResult = await query(
            'DELETE FROM users WHERE id = ?',
            [req.user.id]
        );
        
        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user by ID (admin only)
router.get('/:id',
    authenticateUser,
    param('id').isInt().withMessage('User ID must be a valid integer'),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            // Check if user is admin
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Access denied' });
            }

            const userResult = await query(
                'SELECT id, firebase_uid, name, email, phone, role, created_at, address, workAddress, first_name, last_name, role_id, is_active, email_verified, last_login, reset_token, reset_token_expires, updated_at FROM users WHERE id = ?',
                [req.params.id]
            );
            
            if (userResult.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }
            
            const user = userResult[0];

            res.json(user);
        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Get/Check user online status
router.post('/status', authenticateUser, async (req, res) => {
    try {
        const { userId } = req.body;
        
        // If no userId provided, return current user status
        const targetUserId = userId || req.user.id;
        
        // Find the user using raw MySQL query (without online status columns for now)
        const userResult = await query(
            'SELECT id, name FROM users WHERE id = ?',
            [targetUserId]
        );
        
        if (userResult.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const user = userResult[0];
        
        // For now, we'll consider all users as online since we don't have the status columns
        // This is a temporary solution until the database schema is updated
        const now = new Date();
        const isOnline = true; // Default to online for now
        
        res.json({
            userId: user.id,
            name: user.name,
            isOnline: isOnline,
            lastSeen: now.toISOString(), // Use current time as fallback
            statusUpdatedAt: now.toISOString() // Use current time as fallback
        });
    } catch (error) {
        console.error('Get user status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user online status (for heartbeat/keepalive)
router.put('/status', authenticateUser, async (req, res) => {
    try {
        const { isOnline = true } = req.body;
        const now = new Date();
        
        // Get user data (without updating status columns since they don't exist yet)
        const userResult = await query(
            'SELECT id, name FROM users WHERE id = ?',
            [req.user.id]
        );
        
        if (userResult.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const user = userResult[0];
        
        res.json({
            userId: user.id,
            name: user.name,
            isOnline: isOnline, // Use the parameter value
            lastSeen: now.toISOString(), // Use current time as fallback
            statusUpdatedAt: now.toISOString() // Use current time as fallback
        });
    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get multiple users' online status (bulk check)
router.post('/status/bulk', authenticateUser, async (req, res) => {
    try {
        const { userIds } = req.body;
        
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ message: 'userIds array is required' });
        }
        
        // Limit to 50 users per request
        if (userIds.length > 50) {
            return res.status(400).json({ message: 'Maximum 50 users per request' });
        }
        
        // Create placeholders for the IN clause
        const placeholders = userIds.map(() => '?').join(',');
        
        // Get users using raw MySQL query (without online status columns for now)
        const users = await query(
            `SELECT id, name FROM users WHERE id IN (${placeholders})`,
            userIds
        );
        
        const now = new Date();
        const userStatuses = users.map(user => {
            // For now, consider all users as online since we don't have status columns
            const isOnline = true;
            
            return {
                userId: user.id,
                name: user.name,
                isOnline: isOnline,
                lastSeen: now.toISOString(), // Use current time as fallback
                statusUpdatedAt: now.toISOString() // Use current time as fallback
            };
        });
        
        res.json({ users: userStatuses });
    } catch (error) {
        console.error('Bulk user status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
