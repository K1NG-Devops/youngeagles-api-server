const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const Notification = require('../models/Notification');
const { authenticateUser } = require('../middleware/auth');
const { sanitizeInput, rateLimitStrict } = require('../middleware/security');
const { sendPushNotification } = require('../utils/notifications');
const router = express.Router();

// Get user notifications
router.get('/',
    authenticateUser,
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 50 }),
        query('unreadOnly').optional().isBoolean(),
        query('type').optional().isIn(['message', 'event', 'system', 'alert'])
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;
            const unreadOnly = req.query.unreadOnly === 'true';
            const type = req.query.type;

            const filter = { userId: req.user.id };
            if (unreadOnly) {
                filter.readAt = { $exists: false };
            }
            if (type) {
                filter.type = type;
            }

            const notifications = await Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await Notification.countDocuments(filter);

            res.json({
                notifications,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Get notifications error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Create notification (admin only)
router.post('/',
    authenticateUser,
    rateLimitStrict,
    [
        body('userId').optional().isMongoId(),
        body('userIds').optional().isArray(),
        body('userIds.*').isMongoId(),
        body('type').isIn(['message', 'event', 'system', 'alert']),
        body('title').isLength({ min: 1, max: 200 }).trim(),
        body('message').isLength({ min: 1, max: 1000 }).trim(),
        body('data').optional().isObject(),
        body('broadcast').optional().isBoolean(),
        sanitizeInput
    ],
    async (req, res) => {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Admin access required' });
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { userId, userIds, type, title, message, data, broadcast } = req.body;

            let targetUsers = [];
            if (broadcast) {
                // Send to all users - would need to implement user fetching
                const User = require('../models/User');
                const allUsers = await User.find({}, '_id');
                targetUsers = allUsers.map(user => user._id);
            } else if (userIds && userIds.length > 0) {
                targetUsers = userIds;
            } else if (userId) {
                targetUsers = [userId];
            } else {
                return res.status(400).json({ message: 'Must specify userId, userIds, or broadcast' });
            }

            const notifications = [];
            for (const targetUserId of targetUsers) {
                const notification = new Notification({
                    userId: targetUserId,
                    type,
                    title,
                    message,
                    data: data || {},
                    createdAt: new Date()
                });

                await notification.save();
                notifications.push(notification);

                // Send push notification
                try {
                    await sendPushNotification(targetUserId, {
                        title,
                        body: message,
                        data: data || {}
                    });
                } catch (pushError) {
                    console.error('Push notification error for user', targetUserId, ':', pushError);
                }
            }

            res.status(201).json({
                message: `${notifications.length} notifications created successfully`,
                count: notifications.length
            });
        } catch (error) {
            console.error('Create notification error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Mark notification as read
router.put('/:id/read',
    authenticateUser,
    param('id').isMongoId(),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const notification = await Notification.findById(req.params.id);
            if (!notification) {
                return res.status(404).json({ message: 'Notification not found' });
            }

            // Check if user owns the notification
            if (notification.userId.toString() !== req.user.id) {
                return res.status(403).json({ message: 'Access denied' });
            }

            notification.readAt = new Date();
            await notification.save();

            res.json({ message: 'Notification marked as read' });
        } catch (error) {
            console.error('Mark notification as read error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Mark all notifications as read
router.put('/read-all', authenticateUser, async (req, res) => {
    try {
        await Notification.updateMany(
            { 
                userId: req.user.id, 
                readAt: { $exists: false } 
            },
            { 
                readAt: new Date() 
            }
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete notification
router.delete('/:id',
    authenticateUser,
    param('id').isMongoId(),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const notification = await Notification.findById(req.params.id);
            if (!notification) {
                return res.status(404).json({ message: 'Notification not found' });
            }

            // Check if user owns the notification
            if (notification.userId.toString() !== req.user.id) {
                return res.status(403).json({ message: 'Access denied' });
            }

            await Notification.findByIdAndDelete(req.params.id);
            res.json({ message: 'Notification deleted successfully' });
        } catch (error) {
            console.error('Delete notification error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Get unread notification count
router.get('/count/unread', authenticateUser, async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            userId: req.user.id,
            readAt: { $exists: false }
        });

        res.json({ count });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get notification summary by type
router.get('/summary', authenticateUser, async (req, res) => {
    try {
        const summary = await Notification.aggregate([
            { $match: { userId: req.user.id } },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: 1 },
                    unread: {
                        $sum: {
                            $cond: [
                                { $not: ['$readAt'] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const summaryObj = {};
        summary.forEach(item => {
            summaryObj[item._id] = {
                total: item.total,
                unread: item.unread
            };
        });

        res.json(summaryObj);
    } catch (error) {
        console.error('Get notification summary error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
