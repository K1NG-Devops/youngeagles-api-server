import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// Get all activities
router.get('/', async (req, res) => {
  try {
    const activities = await query('SELECT * FROM activities ORDER BY created_at DESC');
    
    res.json({
      success: true,
      activities: activities || []
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch activities due to server error'
    });
    
  }
});

// Get activity by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [activity] = await query('SELECT * FROM activities WHERE id = ?', [id]);
    
    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }
    
    res.json({
      success: true,
      activity
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create new activity (admin/teacher only)
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      difficulty,
      subject,
      age_group,
      estimated_duration,
      content
    } = req.body;
    
    if (!title || !description || !type) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, and type are required'
      });
    }
    
    const result = await query(
      `INSERT INTO activities 
       (title, description, type, difficulty, subject, age_group, estimated_duration, content, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [title, description, type, difficulty || 'easy', subject, age_group, estimated_duration || 15, JSON.stringify(content || {})]
    );
    
    res.status(201).json({
      success: true,
      activity: {
        id: result.insertId,
        title,
        description,
        type,
        difficulty: difficulty || 'easy',
        subject,
        age_group,
        estimated_duration: estimated_duration || 15,
        content: content || {},
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create activity'
    });
  }
});

// Update activity
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      type,
      difficulty,
      subject,
      age_group,
      estimated_duration,
      content
    } = req.body;
    
    await query(
      `UPDATE activities SET 
       title = COALESCE(?, title),
       description = COALESCE(?, description),
       type = COALESCE(?, type),
       difficulty = COALESCE(?, difficulty),
       subject = COALESCE(?, subject),
       age_group = COALESCE(?, age_group),
       estimated_duration = COALESCE(?, estimated_duration),
       content = COALESCE(?, content),
       updated_at = NOW()
       WHERE id = ?`,
      [title, description, type, difficulty, subject, age_group, estimated_duration, content ? JSON.stringify(content) : null, id]
    );
    
    const [updatedActivity] = await query('SELECT * FROM activities WHERE id = ?', [id]);
    
    res.json({
      success: true,
      activity: updatedActivity
    });
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update activity'
    });
  }
});

// Delete activity
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await query('DELETE FROM activities WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete activity'
    });
  }
});

export default router;
