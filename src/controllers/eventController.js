import Event from '../models/events.js';

// Teacher: Submit a new event (status: pending)
export const createEvent = async (req, res) => {
  try {
    const { title, description, startDate, endDate, type, location, audience, attachments } = req.body;
    const createdBy = req.user?.id || null; // Assumes auth middleware sets req.user
    if (!title || !startDate || !type) {
      return res.status(400).json({ message: 'Title, startDate, and type are required.' });
    }
    const event = await Event.create({
      title,
      description,
      startDate,
      endDate,
      type,
      status: 'pending',
      createdBy,
      location,
      audience,
      attachments,
    });
    res.status(201).json({ message: 'Event submitted for approval.', event });
  } catch (error) {
    res.status(500).json({ message: 'Error creating event', error: error.message });
  }
};

// Admin: Approve an event
export const approveEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    event.status = 'approved';
    await event.save();
    res.json({ message: 'Event approved', event });
  } catch (error) {
    res.status(500).json({ message: 'Error approving event', error: error.message });
  }
};

// Admin: Reject an event
export const rejectEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    event.status = 'rejected';
    await event.save();
    res.json({ message: 'Event rejected', event });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting event', error: error.message });
  }
};

// Get all events (optionally filter by status, audience, type, date)
export const getEvents = async (req, res) => {
  try {
    const { status, audience, type, from, to } = req.query;
    const where = {};
    if (status) where.status = status;
    if (audience) where.audience = audience;
    if (type) where.type = type;
    if (from || to) {
      where.startDate = {};
      if (from) where.startDate['$gte'] = new Date(from);
      if (to) where.startDate['$lte'] = new Date(to);
    }
    const events = await Event.findAll({ where, order: [['startDate', 'ASC']] });
    res.json({ events });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', error: error.message });
  }
};

// Get a single event by ID
export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({ event });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching event', error: error.message });
  }
};

// Optional: Delete an event (admin only)
export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    await event.destroy();
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting event', error: error.message });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const event = await Event.findByPk(id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    await event.update(updates);
    res.json({ message: 'Event updated', event });
  } catch (error) {
    res.status(500).json({ message: 'Error updating event', error: error.message });
  }
}; 

