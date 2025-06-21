import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Parent routes are working',
    timestamp: new Date().toISOString()
  });
});

// Get parent's children (simplified)
router.get('/children', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      children: [],
      message: 'Parent children endpoint working - database queries temporarily disabled',
      parentId: req.user?.id || 'unknown'
    });
  } catch (error) {
    console.error('Error in parent children endpoint:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching children',
      error: error.message 
    });
  }
});

// Get parent's profile (simplified)
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      profile: {
        id: req.user?.id || 'unknown',
        name: req.user?.name || 'Test Parent',
        email: req.user?.email || 'test@example.com'
      },
      message: 'Parent profile endpoint working - database queries temporarily disabled'
    });
  } catch (error) {
    console.error('Error in parent profile endpoint:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching profile',
      error: error.message 
    });
  }
});

// Get homework for parent's children (simplified)
router.get('/homework', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      homework: [],
      message: 'Parent homework endpoint working - database queries temporarily disabled',
      parentId: req.user?.id || 'unknown'
    });
  } catch (error) {
    console.error('Error in parent homework endpoint:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching homework',
      error: error.message 
    });
  }
});

export default router; 