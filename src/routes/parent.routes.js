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

// Get parent's children
router.get('/children', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user?.id;
    
    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found in token'
      });
    }

    // Fetch children for this parent
    const children = await query(
      'SELECT id, name, age, className, grade FROM children WHERE parent_id = ?',
      [parentId],
      'skydek_DB'
    );

    res.json({
      success: true,
      children: children,
      parentId: parentId
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

// Get parent's profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user?.id;
    
    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found in token'
      });
    }

    // Fetch parent profile from database
    const parentProfile = await query(
      'SELECT id, name, email, phone, address, created_at FROM users WHERE id = ?',
      [parentId],
      'skydek_DB'
    );

    if (parentProfile.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parent profile not found'
      });
    }

    const profile = parentProfile[0];
    
    res.json({
      success: true,
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone || null,
        address: profile.address || null,
        member_since: profile.created_at
      }
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

// Get homework for parent's children
router.get('/homework', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user?.id;
    
    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found in token'
      });
    }

    // First get all children for this parent
    const children = await query(
      'SELECT id, name, className FROM children WHERE parent_id = ?',
      [parentId],
      'skydek_DB'
    );

    if (children.length === 0) {
      return res.json({
        success: true,
        homework: [],
        message: 'No children found for this parent'
      });
    }

    const childIds = children.map(child => child.id);
    const placeholders = childIds.map(() => '?').join(',');

    // Fetch homework and submissions for all children
    const homework = await query(
      `SELECT 
        h.id,
        h.title,
        h.instructions as description,
        h.due_date,
        h.class_name,
        h.type as subject,
        s.status as submission_status,
        s.grade,
        s.feedback,
        s.submitted_at,
        c.name as child_name,
        c.id as child_id
      FROM homeworks h
      LEFT JOIN submissions s ON h.id = s.homework_id AND s.child_id IN (${placeholders})
      LEFT JOIN children c ON s.child_id = c.id
      WHERE h.class_name IN (${children.map(child => '?').join(',')})
      ORDER BY h.due_date DESC
      LIMIT 20`,
      [...childIds, ...children.map(child => child.className)],
      'skydek_DB'
    );

    res.json({
      success: true,
      homework: homework,
      children: children,
      parentId: parentId
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
      FROM homeworks h
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