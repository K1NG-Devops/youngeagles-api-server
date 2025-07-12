import express from 'express';
import { verifyTokenMiddleware } from '../utils/security.js';
import { query } from '../db.js';

const router = express.Router();

// Get teacher's profile and assigned class
router.get('/profile', verifyTokenMiddleware, async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied - teachers only' });
    }

    // Get teacher info from staff table
    const [teacher] = await query(
      'SELECT id, name, email, className, role FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher']
    );

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    res.json({
      success: true,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        className: teacher.className,
        role: teacher.role
      }
    });

  } catch (error) {
    console.error('Error fetching teacher profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get students in teacher's class only
router.get('/students', verifyTokenMiddleware, async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied - teachers only' });
    }

    // Get teacher's class assignment
    const [teacher] = await query(
      'SELECT className FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher']
    );

    if (!teacher || !teacher.className) {
      return res.status(404).json({ 
        success: true, 
        students: [], 
        className: null,
        message: 'No class assigned to teacher' 
      });
    }

    // Get students in teacher's class only
    const students = await query(`
      SELECT 
        c.id,
        c.first_name,
        c.last_name,
        c.age,
        c.grade,
        c.parent_id,
        u.name as parent_name,
        u.email as parent_email
      FROM children c
      LEFT JOIN users u ON c.parent_id = u.id
      WHERE c.class_id = (SELECT id FROM classes WHERE name = ?)
      ORDER BY c.first_name
    `, [teacher.className]);

    res.json({
      success: true,
      students,
      className: teacher.className,
      totalStudents: students.length
    });

  } catch (error) {
    console.error('Error fetching teacher students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get homework for teacher's class only
router.get('/homework', verifyTokenMiddleware, async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied - teachers only' });
    }

    console.log(`👩‍🏫 Fetching homework for teacher ${teacherId}`);

    // Get homework created by this teacher with proper assignment type handling
    const homework = await query(`
      SELECT 
        h.*,
        cl.name as class_name,
        COUNT(DISTINCT hs.id) as submissions_count,
        CASE 
          WHEN h.assignment_type = 'individual' THEN (
            SELECT COUNT(*) FROM homework_individual_assignments hia WHERE hia.homework_id = h.id
          )
          ELSE COUNT(DISTINCT c.id)
        END as total_students,
        CASE 
          WHEN h.assignment_type = 'individual' THEN 'Individual Assignment'
          ELSE 'Class Assignment'
        END as assignment_scope
      FROM homework h
      LEFT JOIN classes cl ON cl.id = h.class_id
      LEFT JOIN children c ON c.class_id = h.class_id
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id
      WHERE h.teacher_id = ? AND h.status = 'active'
      GROUP BY h.id
      ORDER BY h.created_at DESC, h.due_date DESC
    `, [teacherId]);

    console.log(`📚 Found ${homework.length} homework assignments for teacher ${teacherId}`);

    // Add individual assignment details for each homework
    for (let hw of homework) {
      if (hw.assignment_type === 'individual') {
        const individualAssignments = await query(`
          SELECT 
            c.id,
            c.first_name,
            c.last_name,
            hia.status as assignment_status,
            hia.assigned_at
          FROM homework_individual_assignments hia
          JOIN children c ON c.id = hia.child_id
          WHERE hia.homework_id = ?
          ORDER BY c.first_name
        `, [hw.id]);
        
        hw.assigned_students = individualAssignments;
        hw.total_students = individualAssignments.length;
      }
    }

    res.json({
      success: true,
      homework,
      totalHomework: homework.length
    });

  } catch (error) {
    console.error('Error fetching teacher homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get teacher's class statistics
router.get('/stats', verifyTokenMiddleware, async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied - teachers only' });
    }

    // Get teacher's class
    const [teacher] = await query(
      'SELECT className FROM staff WHERE id = ? AND role = ?',
      [teacherId, 'teacher']
    );

    if (!teacher || !teacher.className) {
      return res.json({
        success: true,
        stats: {
          totalStudents: 0,
          totalHomework: 0,
          totalSubmissions: 0,
          submissionRate: 0
        },
        className: null
      });
    }

    // Get class ID
    const [classInfo] = await query(
      'SELECT id FROM classes WHERE name = ?',
      [teacher.className]
    );

    if (!classInfo) {
      return res.json({
        success: true,
        stats: {
          totalStudents: 0,
          totalHomework: 0,
          totalSubmissions: 0,
          submissionRate: 0
        },
        className: teacher.className
      });
    }

    const classId = classInfo.id;

    // Get statistics for teacher's class only
    const [studentCount] = await query(
      'SELECT COUNT(*) as count FROM children WHERE class_id = ?',
      [classId]
    );

    const [homeworkCount] = await query(
      'SELECT COUNT(*) as count FROM homework WHERE teacher_id = ?',
      [teacherId]
    );

    const [submissionCount] = await query(`
      SELECT COUNT(*) as count 
      FROM homework_submissions hs
      JOIN homework h ON hs.homework_id = h.id
      WHERE h.teacher_id = ?
    `, [teacherId]);

    const totalStudents = studentCount.count || 0;
    const totalHomework = homeworkCount.count || 0;
    const totalSubmissions = submissionCount.count || 0;
    const submissionRate = totalHomework > 0 && totalStudents > 0 
      ? Math.round((totalSubmissions / (totalHomework * totalStudents)) * 100) 
      : 0;

    res.json({
      success: true,
      stats: {
        totalStudents,
        totalHomework,
        totalSubmissions,
        submissionRate
      },
      className: teacher.className
    });

  } catch (error) {
    console.error('Error fetching teacher stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get assignments for teacher's class only
router.get('/assignments', verifyTokenMiddleware, async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied - teachers only' });
    }

    // Get assignments created by this teacher
    const assignments = await query(`
      SELECT 
        h.id,
        h.title,
        h.description,
        h.due_date,
        h.created_at,
        cl.name as class_name,
        COUNT(DISTINCT hs.id) as submissions_count,
        COUNT(DISTINCT c.id) as total_students,
        CASE 
          WHEN h.due_date < NOW() THEN 'overdue'
          WHEN h.due_date > NOW() THEN 'active'
          ELSE 'due_today'
        END as status
      FROM homework h
      LEFT JOIN classes cl ON cl.id = h.class_id
      LEFT JOIN children c ON c.class_id = h.class_id
      LEFT JOIN homework_submissions hs ON hs.homework_id = h.id
      WHERE h.teacher_id = ?
      GROUP BY h.id
      ORDER BY h.due_date ASC
    `, [teacherId]);

    res.json({
      success: true,
      assignments,
      totalAssignments: assignments.length
    });

  } catch (error) {
    console.error('Error fetching teacher assignments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate teacher token for institution plan subscribers
router.post('/generate-token', verifyTokenMiddleware, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { tokenName, maxChildren = 20 } = req.body;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied - teachers only' });
    }

    // Check if teacher has an active institution subscription
    const [subscription] = await query(`
      SELECT s.*, st.id as staff_id 
      FROM subscriptions s
      JOIN staff st ON s.user_id = st.id
      WHERE st.id = ? AND s.status = 'active' AND s.plan_id = 'institution'
      ORDER BY s.created_at DESC LIMIT 1
    `, [teacherId]);

    if (!subscription) {
      return res.status(403).json({ 
        error: 'Institution plan subscription required to generate teacher tokens' 
      });
    }

    // Generate unique token
    const token = require('crypto').randomBytes(32).toString('hex');
    
    // Create teacher token record
    await query(`
      INSERT INTO teacher_tokens (
        teacher_id, token, token_name, subscription_id, max_children
      ) VALUES (?, ?, ?, ?, ?)
    `, [teacherId, token, tokenName, subscription.id, maxChildren]);

    res.json({
      success: true,
      data: {
        token,
        tokenName,
        maxChildren,
        teacherName: req.user.name,
        instructions: 'Share this token with parents to allow them to link their children to your class'
      }
    });

  } catch (error) {
    console.error('Error generating teacher token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get teacher's tokens
router.get('/tokens', verifyTokenMiddleware, async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied - teachers only' });
    }

    // Get teacher's tokens with linked children count
    const tokens = await query(`
      SELECT 
        tt.*,
        COUNT(tpl.id) as linked_children_count,
        s.plan_name,
        s.status as subscription_status
      FROM teacher_tokens tt
      LEFT JOIN teacher_parent_links tpl ON tt.id = tpl.teacher_token_id AND tpl.is_active = 1
      LEFT JOIN subscriptions s ON tt.subscription_id = s.id
      WHERE tt.teacher_id = ? AND tt.is_active = 1
      GROUP BY tt.id
      ORDER BY tt.created_at DESC
    `, [teacherId]);

    res.json({
      success: true,
      tokens
    });

  } catch (error) {
    console.error('Error fetching teacher tokens:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get children linked to teacher's tokens
router.get('/linked-children', verifyTokenMiddleware, async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied - teachers only' });
    }

    // Get children linked through teacher tokens
    const linkedChildren = await query(`
      SELECT 
        c.*,
        u.name as parent_name,
        u.email as parent_email,
        tt.token_name,
        tt.token,
        tpl.linked_at
      FROM teacher_parent_links tpl
      JOIN teacher_tokens tt ON tpl.teacher_token_id = tt.id
      JOIN children c ON tpl.child_id = c.id
      JOIN users u ON tpl.parent_id = u.id
      WHERE tt.teacher_id = ? AND tpl.is_active = 1 AND tt.is_active = 1
      ORDER BY tpl.linked_at DESC
    `, [teacherId]);

    res.json({
      success: true,
      linkedChildren,
      totalCount: linkedChildren.length
    });

  } catch (error) {
    console.error('Error fetching linked children:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate teacher token
router.post('/deactivate-token/:tokenId', verifyTokenMiddleware, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { tokenId } = req.params;

    // Verify user is a teacher
    if (req.user.userType !== 'teacher') {
      return res.status(403).json({ error: 'Access denied - teachers only' });
    }

    // Verify token belongs to teacher
    const [token] = await query(`
      SELECT id FROM teacher_tokens 
      WHERE id = ? AND teacher_id = ?
    `, [tokenId, teacherId]);

    if (!token) {
      return res.status(404).json({ error: 'Token not found or access denied' });
    }

    // Deactivate token
    await query(`
      UPDATE teacher_tokens 
      SET is_active = 0, updated_at = NOW() 
      WHERE id = ?
    `, [tokenId]);

    res.json({
      success: true,
      message: 'Teacher token deactivated successfully'
    });

  } catch (error) {
    console.error('Error deactivating teacher token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 