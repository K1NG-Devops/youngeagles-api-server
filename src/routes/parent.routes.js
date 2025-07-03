import express from 'express';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get children for the authenticated parent
router.get('/children', authenticateToken, async (req, res) => {
  try {
    const parentId = req.user.id;
    
    const children = await query(
      `SELECT 
        id,
        name,
        className,
        grade,
        age
      FROM children 
      WHERE parent_id = ?
      ORDER BY name ASC`,
      [parentId]
    );

    res.json({
      success: true,
      children
    });
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch children'
    });
  }
});

// Get a specific child's details
router.get('/children/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const parentId = req.user.id;
    
    const [child] = await query(
      `SELECT 
        id,
        name,
        className,
        grade,
        age
      FROM children 
      WHERE id = ? AND parent_id = ?`,
      [id, parentId]
    );

    if (!child) {
      return res.status(404).json({
        success: false,
        error: 'Child not found'
      });
    }

    res.json({
      success: true,
      child
    });
  } catch (error) {
    console.error('Error fetching child:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch child details'
    });
  }
});

export default router; 