import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { execute } from '../db.js';

const router = express.Router();

// Get all activities
router.get('/', authenticateToken, async (req, res) => {
  try {
    const activities = await execute(`
      SELECT * FROM activities 
      WHERE is_active = 1 
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      activities
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Get activity attempt status
router.get('/attempt-status/:activityId', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;
    const userId = req.user.id;

    const [attemptStatus] = await execute(`
      SELECT 
        COUNT(*) as attempt_count,
        MAX(submitted_at) as last_attempt,
        MAX(CASE WHEN is_final = 1 THEN 1 ELSE 0 END) as has_final_submission
      FROM activity_submissions
      WHERE user_id = ? AND activity_id = ? AND DATE(submitted_at) = CURDATE()
    `, [userId, activityId]);

    res.json({
      success: true,
      status: {
        attemptCount: attemptStatus.attempt_count || 0,
        lastAttempt: attemptStatus.last_attempt,
        hasFinalSubmission: Boolean(attemptStatus.has_final_submission),
        attemptsRemaining: Math.max(0, 2 - (attemptStatus.attempt_count || 0)),
        canSubmit: (attemptStatus.attempt_count || 0) < 2 && !attemptStatus.has_final_submission
      }
    });
  } catch (error) {
    console.error('Error fetching attempt status:', error);
    res.status(500).json({ error: 'Failed to fetch attempt status' });
  }
});

// Submit activity result
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { 
      activityId,
      activityType,
      score,
      timeElapsed,
      attempts,
      commandsUsed,
      completed,
      difficulty,
      metadata = {},
      isFinal = false
    } = req.body;

    const userId = req.user.id;
    const userType = req.user.userType || req.user.role;

    // Check attempt limit
    const [attemptStatus] = await execute(`
      SELECT COUNT(*) as attempt_count,
        MAX(CASE WHEN is_final = 1 THEN 1 ELSE 0 END) as has_final_submission
      FROM activity_submissions
      WHERE user_id = ? AND activity_id = ? AND DATE(submitted_at) = CURDATE()
    `, [userId, activityId]);

    if (attemptStatus.has_final_submission) {
      return res.status(400).json({ 
        error: 'Final submission already exists for today',
        attemptStatus: {
          hasFinalSubmission: true,
          canSubmit: false
        }
      });
    }

    if (!isFinal && attemptStatus.attempt_count >= 2) {
      return res.status(400).json({ 
        error: 'Maximum attempts reached for today',
        attemptStatus: {
          attemptCount: attemptStatus.attempt_count,
          canSubmit: false
        }
      });
    }

    // Create activity submission record
    const result = await execute(`
      INSERT INTO activity_submissions (
        user_id,
        user_type,
        activity_id,
        activity_type,
        score,
        time_elapsed,
        attempts,
        commands_used,
        completed,
        difficulty,
        metadata,
        is_final,
        submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      userId,
      userType,
      activityId,
      activityType,
      score,
      timeElapsed,
      attempts,
      commandsUsed,
      completed ? 1 : 0,
      difficulty,
      JSON.stringify(metadata),
      isFinal ? 1 : 0
    ]);

    // If this is a child user, update their progress
    if (userType === 'student' || userType === 'child') {
      await execute(`
        INSERT INTO student_progress (
          student_id,
          activity_id,
          activity_type,
          score,
          completed,
          last_attempt_at,
          is_final
        ) VALUES (?, ?, ?, ?, ?, NOW(), ?)
        ON DUPLICATE KEY UPDATE
          score = GREATEST(score, VALUES(score)),
          completed = VALUES(completed),
          last_attempt_at = NOW(),
          is_final = VALUES(is_final)
      `, [userId, activityId, activityType, score, completed ? 1 : 0, isFinal ? 1 : 0]);
    }

    // Get updated attempt status
    const [newAttemptStatus] = await execute(`
      SELECT COUNT(*) as attempt_count
      FROM activity_submissions
      WHERE user_id = ? AND activity_id = ? AND DATE(submitted_at) = CURDATE()
    `, [userId, activityId]);

    res.json({
      success: true,
      message: 'Activity submission recorded successfully',
      submissionId: result.insertId,
      attemptStatus: {
        attemptCount: newAttemptStatus.attempt_count,
        attemptsRemaining: Math.max(0, 2 - newAttemptStatus.attempt_count),
        canSubmit: newAttemptStatus.attempt_count < 2 && !isFinal,
        isFinal
      }
    });

  } catch (error) {
    console.error('Error submitting activity:', error);
    res.status(500).json({ error: 'Failed to submit activity' });
  }
});

// Reset activity attempts (admin only)
router.post('/reset-attempts/:userId/:activityId', authenticateToken, async (req, res) => {
  try {
    const { userId, activityId } = req.params;
    const adminId = req.user.id;
    
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can reset attempts' });
    }

    // Clear final submission flag and record the reset
    await execute(`
      UPDATE activity_submissions 
      SET is_final = 0,
          metadata = JSON_SET(
            COALESCE(metadata, '{}'),
            '$.reset_by', ?,
            '$.reset_at', NOW()
          )
      WHERE user_id = ? AND activity_id = ? AND DATE(submitted_at) = CURDATE()
    `, [adminId, userId, activityId]);

    // Update student progress
    await execute(`
      UPDATE student_progress
      SET is_final = 0
      WHERE student_id = ? AND activity_id = ?
    `, [userId, activityId]);

    res.json({
      success: true,
      message: 'Activity attempts reset successfully'
    });

  } catch (error) {
    console.error('Error resetting activity attempts:', error);
    res.status(500).json({ error: 'Failed to reset activity attempts' });
  }
});

// Get user's activity history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const submissions = await execute(`
      SELECT 
        s.*,
        a.name as activity_name,
        a.description as activity_description
      FROM activity_submissions s
      LEFT JOIN activities a ON s.activity_id = a.id
      WHERE s.user_id = ?
      ORDER BY s.submitted_at DESC
    `, [userId]);

    res.json({
      success: true,
      submissions
    });

  } catch (error) {
    console.error('Error fetching activity history:', error);
    res.status(500).json({ error: 'Failed to fetch activity history' });
  }
});

// Get activity progress for a student
router.get('/progress/:studentId', authenticateToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const requestingUserId = req.user.id;
    const userType = req.user.userType || req.user.role;

    // Check if user has permission to view this student's progress
    if (userType !== 'admin' && userType !== 'teacher' && requestingUserId !== studentId) {
      return res.status(403).json({ error: 'Unauthorized to view this student\'s progress' });
    }

    const progress = await execute(`
      SELECT 
        p.*,
        a.name as activity_name,
        a.description as activity_description,
        s.metadata as last_submission_data
      FROM student_progress p
      LEFT JOIN activities a ON p.activity_id = a.id
      LEFT JOIN activity_submissions s ON s.id = (
        SELECT id FROM activity_submissions 
        WHERE user_id = p.student_id AND activity_id = p.activity_id 
        ORDER BY submitted_at DESC LIMIT 1
      )
      WHERE p.student_id = ?
      ORDER BY p.last_attempt_at DESC
    `, [studentId]);

    res.json({
      success: true,
      progress
    });

  } catch (error) {
    console.error('Error fetching student progress:', error);
    res.status(500).json({ error: 'Failed to fetch student progress' });
  }
});

export default router;
