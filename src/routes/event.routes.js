import express from 'express';
import {
  createEvent,
  approveEvent,
  rejectEvent,
  getEvents,
  getEventById,
  deleteEvent
} from '../controllers/eventController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

// Admin middleware
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Admin role required.' });
};

const router = express.Router();

// Teacher: Submit event
router.post('/events', authMiddleware, createEvent);

// Get all events (optionally filtered)
router.get('/events', getEvents);

// Get single event
router.get('/events/:id', getEventById);

// Admin: Approve event
router.put('/events/:id/approve', authMiddleware, isAdmin, approveEvent);

// Admin: Reject event
router.put('/events/:id/reject', authMiddleware, isAdmin, rejectEvent);

// Admin: Delete event
router.delete('/events/:id', authMiddleware, isAdmin, deleteEvent);

export default router; 