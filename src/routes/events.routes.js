import express from 'express';
const router = express.Router();

// Mock Events Data
const events = [
  {
    id: 1,
    title: 'Science Exhibition',
    date: '2025-08-20',
    time: '10:00 AM - 3:00 PM',
    location: 'Main Hall',
    description: 'Annual science exhibition showcasing projects by students.',
    type: 'exhibition',
    priority: 'high'
  },
  {
    id: 2,
    title: 'Parent-Teacher Meeting',
    date: '2025-09-15',
    time: '9:00 AM - 11:00 AM',
    location: 'Conference Room',
    description: 'Discuss your child\'s progress with their teachers.',
    type: 'meeting',
    priority: 'medium'
  },
  {
    id: 3,
    title: 'School Sports Day',
    date: '2025-10-05',
    time: '8:00 AM - 12:00 PM',
    location: 'Sports Ground',
    description: 'Join us for a day of fun and fitness!',
    type: 'event',
    priority: 'low'
  }
];

// GET /api/events
router.get('/', (req, res) => {
  res.json({ events });
});

export default router;

