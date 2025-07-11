import express from 'express';
import { verifyTokenMiddleware } from '../utils/security.js';
import { query } from '../db.js';
import aiGradingService from '../services/aiGrading.js';

const router = express.Router();

// Start AI grading for submissions
router.post('/grading/start', verifyTokenMiddleware, async (req, res) => {
  try {
    const { submissions } = req.body;
    const _teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied - teachers only' 
      });
    }

    if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid submissions array is required'
      });
    }

    console.log(`🤖 Starting AI grading for ${submissions.length} submissions by teacher ${_teacherId}`);

    const result = await aiGradingService.startGrading(submissions, _teacherId, query);

    res.json({
      success: true,
      data: result,
      message: 'AI grading started successfully'
    });

  } catch (error) {
    console.error('AI grading start error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start AI grading',
      message: error.message
    });
  }
});

// Get grading queue status for teacher
router.get('/grading/queue', verifyTokenMiddleware, async (req, res) => {
  try {
    const _teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied - teachers only' 
      });
    }

    const queueStatus = aiGradingService.getQueueStatus(_teacherId);

    res.json({
      success: true,
      queue: queueStatus,
      message: 'Queue status retrieved successfully'
    });

  } catch (error) {
    console.error('AI grading queue error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get grading queue',
      message: error.message
    });
  }
});

// Get grading results for specific submission
router.get('/grading/results/:submissionId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const _teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied - teachers only' 
      });
    }

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        error: 'Submission ID is required'
      });
    }

    const result = await aiGradingService.getGradingResults(parseInt(submissionId));

    if (result.success) {
      res.json({
        success: true,
        data: result.result,
        message: 'Grading results retrieved successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Grading results not found',
        message: result.message
      });
    }

  } catch (error) {
    console.error('AI grading results error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get grading results',
      message: error.message
    });
  }
});

// Generate lesson content (future AI feature)
router.post('/lessons/generate', verifyTokenMiddleware, async (req, res) => {
  try {
    const { topic, grade, duration, objectives } = req.body;
    const _teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied - teachers only' 
      });
    }

    // Mock lesson generation (future implementation)
    const mockLesson = {
      id: Date.now(),
      title: `${topic} - Grade ${grade} Lesson`,
      duration: duration || 45,
      objectives: objectives || [`Understand ${topic}`, `Apply ${topic} concepts`],
      activities: [
        { type: 'introduction', duration: 10, description: 'Introduce the topic' },
        { type: 'main_activity', duration: 25, description: 'Interactive learning' },
        { type: 'conclusion', duration: 10, description: 'Review and assessment' }
      ],
      materials: ['Whiteboard', 'Worksheets', 'Visual aids'],
      assessment: 'Oral questions and worksheet completion',
      generatedAt: new Date(),
      teacherId: _teacherId
    };

    res.json({
      success: true,
      lesson: mockLesson,
      message: 'Lesson generated successfully (AI feature coming soon!)'
    });

  } catch (error) {
    console.error('AI lesson generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate lesson',
      message: error.message
    });
  }
});

// Health check for AI services
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'AI Services',
    status: 'operational',
    features: {
      grading: 'active',
      lessons: 'coming_soon',
      feedback: 'active'
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
