const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const Event = require('../models/Event');
const { authenticateUser } = require('../middleware/auth');
const { sanitizeInput, rateLimitStrict } = require('../middleware/security');
const { sendEventNotification } = require('../utils/notifications');
const router = express.Router();

// Get events with filtering and pagination
router.get('/',
    authenticateUser,
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('type').optional().isIn(['flight', 'ground_school', 'meeting', 'maintenance', 'other']),
        query('status').optional().isIn(['scheduled', 'confirmed', 'cancelled', 'completed']),
        query('instructorId').optional().isMongoId(),
        query('studentId').optional().isMongoId()
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

            const filter = {};

            // Date range filtering
            if (req.query.startDate || req.query.endDate) {
                filter.scheduledDate = {};
                if (req.query.startDate) {
                    filter.scheduledDate.$gte = new Date(req.query.startDate);
                }
                if (req.query.endDate) {
                    filter.scheduledDate.$lte = new Date(req.query.endDate);
                }
            }

            // Other filters
            if (req.query.type) filter.type = req.query.type;
            if (req.query.status) filter.status = req.query.status;
            if (req.query.instructorId) filter.instructorId = req.query.instructorId;
            if (req.query.studentId) filter.studentId = req.query.studentId;

            // Role-based filtering
            if (req.user.role === 'student') {
                filter.studentId = req.user.id;
            } else if (req.user.role === 'instructor') {
                filter.instructorId = req.user.id;
            }

            const events = await Event.find(filter)
                .populate('instructorId', 'firstName lastName email')
                .populate('studentId', 'firstName lastName email')
                .sort({ scheduledDate: 1 })
                .skip(skip)
                .limit(limit);

            const total = await Event.countDocuments(filter);

            res.json({
                events,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Get events error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Create new event
router.post('/',
    authenticateUser,
    rateLimitStrict,
    [
        body('title').isLength({ min: 1, max: 200 }).trim(),
        body('description').optional().isLength({ max: 1000 }).trim(),
        body('type').isIn(['flight', 'ground_school', 'meeting', 'maintenance', 'other']),
        body('scheduledDate').isISO8601(),
        body('duration').isInt({ min: 15, max: 480 }), // 15 minutes to 8 hours
        body('instructorId').optional().isMongoId(),
        body('studentId').optional().isMongoId(),
        body('aircraftId').optional().isMongoId(),
        body('location').optional().isLength({ max: 200 }).trim(),
        body('notes').optional().isLength({ max: 500 }).trim(),
        body('requirements').optional().isArray(),
        body('requirements.*').optional().isString(),
        sanitizeInput
    ],
    async (req, res) => {
        try {
            // Check permissions - only instructors and admins can create events
            if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Only instructors and admins can create events' });
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const {
                title,
                description,
                type,
                scheduledDate,
                duration,
                instructorId,
                studentId,
                aircraftId,
                location,
                notes,
                requirements
            } = req.body;

            // If instructor creating event, set themselves as instructor
            const finalInstructorId = req.user.role === 'instructor' ? req.user.id : instructorId;

            const event = new Event({
                title,
                description,
                type,
                scheduledDate: new Date(scheduledDate),
                duration,
                instructorId: finalInstructorId,
                studentId,
                aircraftId,
                location,
                notes,
                requirements: requirements || [],
                status: 'scheduled',
                createdBy: req.user.id,
                createdAt: new Date()
            });

            await event.save();

            // Populate the created event
            await event.populate('instructorId', 'firstName lastName email');
            await event.populate('studentId', 'firstName lastName email');

            // Send notification to student if assigned
            if (studentId) {
                try {
                    await sendEventNotification(studentId, 'event_scheduled', {
                        eventTitle: title,
                        scheduledDate: scheduledDate,
                        instructorName: `${event.instructorId.firstName} ${event.instructorId.lastName}`
                    });
                } catch (notificationError) {
                    console.error('Event notification error:', notificationError);
                }
            }

            res.status(201).json({
                message: 'Event created successfully',
                event
            });
        } catch (error) {
            console.error('Create event error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Get specific event
router.get('/:id',
    authenticateUser,
    param('id').isMongoId(),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const event = await Event.findById(req.params.id)
                .populate('instructorId', 'firstName lastName email phone')
                .populate('studentId', 'firstName lastName email phone')
                .populate('aircraftId', 'tailNumber model');

            if (!event) {
                return res.status(404).json({ message: 'Event not found' });
            }

            // Check access permissions
            const hasAccess = req.user.role === 'admin' ||
                             event.instructorId?._id.toString() === req.user.id ||
                             event.studentId?._id.toString() === req.user.id;

            if (!hasAccess) {
                return res.status(403).json({ message: 'Access denied' });
            }

            res.json(event);
        } catch (error) {
            console.error('Get event error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Update event
router.put('/:id',
    authenticateUser,
    param('id').isMongoId(),
    [
        body('title').optional().isLength({ min: 1, max: 200 }).trim(),
        body('description').optional().isLength({ max: 1000 }).trim(),
        body('type').optional().isIn(['flight', 'ground_school', 'meeting', 'maintenance', 'other']),
        body('scheduledDate').optional().isISO8601(),
        body('duration').optional().isInt({ min: 15, max: 480 }),
        body('instructorId').optional().isMongoId(),
        body('studentId').optional().isMongoId(),
        body('aircraftId').optional().isMongoId(),
        body('location').optional().isLength({ max: 200 }).trim(),
        body('notes').optional().isLength({ max: 500 }).trim(),
        body('status').optional().isIn(['scheduled', 'confirmed', 'cancelled', 'completed']),
        body('requirements').optional().isArray(),
        body('requirements.*').optional().isString(),
        sanitizeInput
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const event = await Event.findById(req.params.id);
            if (!event) {
                return res.status(404).json({ message: 'Event not found' });
            }

            // Check permissions
            const canEdit = req.user.role === 'admin' ||
                           event.instructorId?.toString() === req.user.id ||
                           event.createdBy?.toString() === req.user.id;

            if (!canEdit) {
                return res.status(403).json({ message: 'Permission denied' });
            }

            // Update fields
            const updateFields = {};
            const allowedFields = [
                'title', 'description', 'type', 'scheduledDate', 'duration',
                'instructorId', 'studentId', 'aircraftId', 'location', 'notes',
                'status', 'requirements'
            ];

            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateFields[field] = req.body[field];
                    if (field === 'scheduledDate') {
                        updateFields[field] = new Date(req.body[field]);
                    }
                }
            });

            updateFields.updatedAt = new Date();

            const updatedEvent = await Event.findByIdAndUpdate(
                req.params.id,
                updateFields,
                { new: true }
            ).populate('instructorId', 'firstName lastName email')
             .populate('studentId', 'firstName lastName email')
             .populate('aircraftId', 'tailNumber model');

            // Send notifications for significant changes
            if (req.body.scheduledDate || req.body.status) {
                try {
                    if (updatedEvent.studentId) {
                        await sendEventNotification(updatedEvent.studentId._id, 'event_updated', {
                            eventTitle: updatedEvent.title,
                            scheduledDate: updatedEvent.scheduledDate,
                            status: updatedEvent.status
                        });
                    }
                } catch (notificationError) {
                    console.error('Event update notification error:', notificationError);
                }
            }

            res.json({
                message: 'Event updated successfully',
                event: updatedEvent
            });
        } catch (error) {
            console.error('Update event error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Delete event
router.delete('/:id',
    authenticateUser,
    param('id').isMongoId(),
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const event = await Event.findById(req.params.id);
            if (!event) {
                return res.status(404).json({ message: 'Event not found' });
            }

            // Check permissions
            const canDelete = req.user.role === 'admin' ||
                             event.instructorId?.toString() === req.user.id ||
                             event.createdBy?.toString() === req.user.id;

            if (!canDelete) {
                return res.status(403).json({ message: 'Permission denied' });
            }

            await Event.findByIdAndDelete(req.params.id);

            // Send cancellation notification
            if (event.studentId) {
                try {
                    await sendEventNotification(event.studentId, 'event_cancelled', {
                        eventTitle: event.title,
                        scheduledDate: event.scheduledDate
                    });
                } catch (notificationError) {
                    console.error('Event cancellation notification error:', notificationError);
                }
            }

            res.json({ message: 'Event deleted successfully' });
        } catch (error) {
            console.error('Delete event error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Get available time slots for scheduling
router.get('/availability/:instructorId',
    authenticateUser,
    [
        param('instructorId').isMongoId(),
        query('date').isISO8601(),
        query('duration').optional().isInt({ min: 15, max: 480 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { instructorId } = req.params;
            const date = new Date(req.query.date);
            const duration = parseInt(req.query.duration) || 60;

            // Get events for the specific date
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const existingEvents = await Event.find({
                instructorId,
                scheduledDate: {
                    $gte: startOfDay,
                    $lte: endOfDay
                },
                status: { $in: ['scheduled', 'confirmed'] }
            }).sort({ scheduledDate: 1 });

            // Define working hours (8 AM to 6 PM)
            const workingHours = {
                start: 8,
                end: 18
            };

            const availableSlots = [];
            let currentTime = workingHours.start * 60; // Convert to minutes
            const endTime = workingHours.end * 60;

            for (const event of existingEvents) {
                const eventStart = event.scheduledDate.getHours() * 60 + event.scheduledDate.getMinutes();
                const eventEnd = eventStart + event.duration;

                // Add slot before event if there's enough time
                if (currentTime + duration <= eventStart) {
                    while (currentTime + duration <= eventStart) {
                        const slotHour = Math.floor(currentTime / 60);
                        const slotMinute = currentTime % 60;
                        availableSlots.push({
                            time: `${slotHour.toString().padStart(2, '0')}:${slotMinute.toString().padStart(2, '0')}`,
                            duration
                        });
                        currentTime += 30; // 30-minute increments
                    }
                }

                currentTime = Math.max(currentTime, eventEnd);
            }

            // Add remaining slots after last event
            while (currentTime + duration <= endTime) {
                const slotHour = Math.floor(currentTime / 60);
                const slotMinute = currentTime % 60;
                availableSlots.push({
                    time: `${slotHour.toString().padStart(2, '0')}:${slotMinute.toString().padStart(2, '0')}`,
                    duration
                });
                currentTime += 30;
            }

            res.json({
                date: date.toISOString().split('T')[0],
                availableSlots
            });
        } catch (error) {
            console.error('Get availability error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

module.exports = router;
