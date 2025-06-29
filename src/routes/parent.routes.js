import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { query } from '../db.js';

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

// Get reports for a specific child
router.get('/reports', authMiddleware, async (req, res) => {
  try {
    const { child_id } = req.query;
    const parentId = req.user.id;

    if (!child_id) {
      return res.status(400).json({
        success: false,
        message: 'Child ID is required'
      });
    }

    // Verify the child belongs to this parent
    const childCheck = await query(
      'SELECT id FROM children WHERE id = ? AND parent_id = ?',
      [child_id, parentId],
      'skydek_DB'
    );

    if (childCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Child not found or does not belong to this parent'
      });
    }

    // Fetch the latest progress report
    const reports = await query(
      `SELECT 
        sr.*,
        JSON_OBJECT(
          'academic', sr.academic_progress,
          'social', sr.social_progress,
          'emotional', sr.emotional_progress,
          'physical', sr.physical_progress
        ) as progress_data,
        c.name as child_name,
        c.className,
        s.name as teacher_name
      FROM student_reports sr
      JOIN children c ON sr.child_id = c.id
      LEFT JOIN staff s ON sr.teacher_id = s.id
      WHERE sr.child_id = ?
      ORDER BY sr.created_at DESC
      LIMIT 1`,
      [child_id],
      'skydek_DB'
    );

    // Fetch attendance data
    const attendance = await query(
      `SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days
      FROM attendance
      WHERE child_id = ?
      AND attendance_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)`,
      [child_id],
      'skydek_DB'
    );

    // Fetch recent homework submissions
    const homework = await query(
      `SELECT 
        h.title,
        h.due_date,
        s.status as submission_status,
        s.grade,
        s.feedback
      FROM homework h
      LEFT JOIN submissions s ON h.id = s.homework_id
      WHERE s.child_id = ?
      ORDER BY h.due_date DESC
      LIMIT 5`,
      [child_id],
      'skydek_DB'
    );

    // Format the response
    const report = reports[0] || null;
    const formattedReport = report ? {
      ...report,
      progress_data: typeof report.progress_data === 'string' 
        ? JSON.parse(report.progress_data)
        : report.progress_data,
      attendance: attendance[0] || {
        total_days: 0,
        present_days: 0,
        absent_days: 0,
        late_days: 0
      },
      recent_homework: homework || []
    } : null;

    res.json({
      success: true,
      report: formattedReport
    });

  } catch (error) {
    console.error('Error fetching child reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message
    });
  }
});

export default router; 