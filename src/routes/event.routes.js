import express from 'express';
import {
  createEvent,
  approveEvent,
  rejectEvent,
  getEvents,
  getEventById,
  deleteEvent,
  updateEvent
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
router.post('/', authMiddleware, createEvent);

// Get all events (optionally filtered)
router.get('/', getEvents);

// Get single event
router.get('/:id', getEventById);

// Admin: Approve event
router.put('/:id/approve', authMiddleware, isAdmin, approveEvent);

// Admin: Reject event
router.put('/:id/reject', authMiddleware, isAdmin, rejectEvent);

// Admin: Delete event
router.delete('/:id', authMiddleware, isAdmin, deleteEvent);

// Admin: Update event
router.put('/:id', authMiddleware, isAdmin, updateEvent);

export default router; 