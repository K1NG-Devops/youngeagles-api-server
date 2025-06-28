const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const { authenticateUser } = require('../middleware/auth');
const { sanitizeInput, rateLimitStrict } = require('../middleware/security');
const { sendPushNotification } = require('../utils/notifications');
const router = express.Router();

// Send message
router.post('/send',
    authenticateUser,
    rateLimitStrict,
    [
        body('recipientId').isMongoId(),
        body('subject').isLength({ min: 1, max: 200 }).trim(),
        body('content').isLength({ min: 1, max: 2000 }).trim(),
        body('type').optional().isIn(['message', 'announcement', 'alert']),
        sanitizeInput
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { recipientId, subject, content, type = 'message' } = req.body;

            const message = new Message({
                senderId: req.user.id,
                recipientId,
                subject,
                content,
                type,
                sentAt: new Date()
            });

            await message.save();

            // Create notification for recipient
            const notification = new Notification({
                userId: recipientId,
                type: 'message',
                title: `New message: ${subject}`,
                message: `You have a new message from ${req.user.firstName} ${req.user.lastName}`,
                data: { messageId: message._id },
                createdAt: new Date()
            });

            await notification.save();

            // Send push notification
            await sendPushNotification(recipientId, {
                title: notification.title,
                body: notification.message,
                data: notification.data
            });

            res.status(201).json({
                message: 'Message sent successfully',
                messageId: message._id
            });
        } catch (error) {
            console.error('Send message error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Get messages (inbox)
router.get('/inbox',
    authenticateUser,
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 50 }),
        query('unreadOnly').optional().isBoolean()
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

            const filter = { recipientId: req.user.id };
            if (unreadOnly) {
                filter.readAt = { $exists: false };
            }

            const messages = await Message.find(filter)
                .populate('senderId', 'firstName lastName email')
                .sort({ sentAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await Message.countDocuments(filter);

            res.json({
                messages,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Get messages error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Get sent messages
router.get('/sent',
    authenticateUser,
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 50 })
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

            const messages = await Message.find({ senderId: req.user.id })
                .populate('recipientId', 'firstName lastName email')
                .sort({ sentAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await Message.countDocuments({ senderId: req.user.id });

            res.json({
                messages,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Get sent messages error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Get single message
router.get('/:id',
    authenticateUser,
    param('id').isMongoId(),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const message = await Message.findById(req.params.id)
                .populate('senderId', 'firstName lastName email')
                .populate('recipientId', 'firstName lastName email');

            if (!message) {
                return res.status(404).json({ message: 'Message not found' });
            }

            // Check if user is sender or recipient
            if (message.senderId._id.toString() !== req.user.id && 
                message.recipientId._id.toString() !== req.user.id) {
                return res.status(403).json({ message: 'Access denied' });
            }

            // Mark as read if user is recipient and message is unread
            if (message.recipientId._id.toString() === req.user.id && !message.readAt) {
                message.readAt = new Date();
                await message.save();
            }

            res.json(message);
        } catch (error) {
            console.error('Get message error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Delete message
router.delete('/:id',
    authenticateUser,
    param('id').isMongoId(),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const message = await Message.findById(req.params.id);
            if (!message) {
                return res.status(404).json({ message: 'Message not found' });
            }

            // Check if user is sender or recipient
            if (message.senderId.toString() !== req.user.id && 
                message.recipientId.toString() !== req.user.id) {
                return res.status(403).json({ message: 'Access denied' });
            }

            await Message.findByIdAndDelete(req.params.id);
            res.json({ message: 'Message deleted successfully' });
        } catch (error) {
            console.error('Delete message error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Mark message as read
router.put('/:id/read',
    authenticateUser,
    param('id').isMongoId(),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const message = await Message.findById(req.params.id);
            if (!message) {
                return res.status(404).json({ message: 'Message not found' });
            }

            // Check if user is recipient
            if (message.recipientId.toString() !== req.user.id) {
                return res.status(403).json({ message: 'Access denied' });
            }

            message.readAt = new Date();
            await message.save();

            res.json({ message: 'Message marked as read' });
        } catch (error) {
            console.error('Mark as read error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Get unread message count
router.get('/count/unread', authenticateUser, async (req, res) => {
    try {
        const count = await Message.countDocuments({
            recipientId: req.user.id,
            readAt: { $exists: false }
        });

        res.json({ count });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
