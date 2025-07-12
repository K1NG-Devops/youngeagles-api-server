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

// Link child to teacher using teacher token
router.post('/link-to-teacher', authenticateToken, async (req, res) => {
  try {
    const parentId = req.user.id;
    const { teacherToken, childId } = req.body;

    if (!teacherToken || !childId) {
      return res.status(400).json({
        success: false,
        error: 'Teacher token and child ID are required'
      });
    }

    // Verify parent owns the child
    const [child] = await query(
      'SELECT id, name FROM children WHERE id = ? AND parent_id = ?',
      [childId, parentId]
    );

    if (!child) {
      return res.status(404).json({
        success: false,
        error: 'Child not found or access denied'
      });
    }

    // Find and validate teacher token
    const [tokenInfo] = await query(`
      SELECT 
        tt.*,
        st.name as teacher_name,
        st.email as teacher_email,
        s.status as subscription_status
      FROM teacher_tokens tt
      JOIN staff st ON tt.teacher_id = st.id
      JOIN subscriptions s ON tt.subscription_id = s.id
      WHERE tt.token = ? AND tt.is_active = 1 AND s.status = 'active'
    `, [teacherToken]);

    if (!tokenInfo) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired teacher token'
      });
    }

    // Check if token has reached maximum children limit
    const [currentCount] = await query(`
      SELECT COUNT(*) as count 
      FROM teacher_parent_links 
      WHERE teacher_token_id = ? AND is_active = 1
    `, [tokenInfo.id]);

    if (currentCount.count >= tokenInfo.max_children) {
      return res.status(400).json({
        success: false,
        error: `Teacher has reached maximum capacity of ${tokenInfo.max_children} children`
      });
    }

    // Check if child is already linked to this teacher
    const [existingLink] = await query(`
      SELECT id FROM teacher_parent_links 
      WHERE teacher_token_id = ? AND parent_id = ? AND child_id = ? AND is_active = 1
    `, [tokenInfo.id, parentId, childId]);

    if (existingLink) {
      return res.status(400).json({
        success: false,
        error: 'Child is already linked to this teacher'
      });
    }

    // Create the link
    await query(`
      INSERT INTO teacher_parent_links (teacher_token_id, parent_id, child_id)
      VALUES (?, ?, ?)
    `, [tokenInfo.id, parentId, childId]);

    // Update current children count
    await query(`
      UPDATE teacher_tokens 
      SET current_children = current_children + 1, updated_at = NOW()
      WHERE id = ?
    `, [tokenInfo.id]);

    res.json({
      success: true,
      message: `${child.name} successfully linked to ${tokenInfo.teacher_name}'s class`,
      data: {
        childName: child.name,
        teacherName: tokenInfo.teacher_name,
        tokenName: tokenInfo.token_name,
        linkedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error linking child to teacher:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to link child to teacher'
    });
  }
});

// Get child's teacher links
router.get('/teacher-links', authenticateToken, async (req, res) => {
  try {
    const parentId = req.user.id;

    // Get all teacher links for parent's children
    const links = await query(`
      SELECT 
        c.id as child_id,
        c.name as child_name,
        st.name as teacher_name,
        st.email as teacher_email,
        tt.token_name,
        tpl.linked_at,
        tpl.is_active
      FROM teacher_parent_links tpl
      JOIN teacher_tokens tt ON tpl.teacher_token_id = tt.id
      JOIN staff st ON tt.teacher_id = st.id
      JOIN children c ON tpl.child_id = c.id
      WHERE tpl.parent_id = ? AND tpl.is_active = 1
      ORDER BY tpl.linked_at DESC
    `, [parentId]);

    res.json({
      success: true,
      links
    });

  } catch (error) {
    console.error('Error fetching teacher links:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch teacher links'
    });
  }
});

// Unlink child from teacher
router.post('/unlink-from-teacher', authenticateToken, async (req, res) => {
  try {
    const parentId = req.user.id;
    const { childId, teacherToken } = req.body;

    if (!childId || !teacherToken) {
      return res.status(400).json({
        success: false,
        error: 'Child ID and teacher token are required'
      });
    }

    // Find the link
    const [link] = await query(`
      SELECT tpl.id, tt.id as token_id, c.name as child_name, st.name as teacher_name
      FROM teacher_parent_links tpl
      JOIN teacher_tokens tt ON tpl.teacher_token_id = tt.id
      JOIN staff st ON tt.teacher_id = st.id
      JOIN children c ON tpl.child_id = c.id
      WHERE tpl.parent_id = ? AND tpl.child_id = ? AND tt.token = ? AND tpl.is_active = 1
    `, [parentId, childId, teacherToken]);

    if (!link) {
      return res.status(404).json({
        success: false,
        error: 'Link not found or access denied'
      });
    }

    // Deactivate the link
    await query(`
      UPDATE teacher_parent_links 
      SET is_active = 0 
      WHERE id = ?
    `, [link.id]);

    // Update teacher token children count
    await query(`
      UPDATE teacher_tokens 
      SET current_children = current_children - 1, updated_at = NOW()
      WHERE id = ?
    `, [link.token_id]);

    res.json({
      success: true,
      message: `${link.child_name} successfully unlinked from ${link.teacher_name}'s class`
    });

  } catch (error) {
    console.error('Error unlinking child from teacher:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlink child from teacher'
    });
  }
});

// Validate teacher token (for preview before linking)
router.post('/validate-teacher-token', authenticateToken, async (req, res) => {
  try {
    const { teacherToken } = req.body;

    if (!teacherToken) {
      return res.status(400).json({
        success: false,
        error: 'Teacher token is required'
      });
    }

    // Find and validate teacher token
    const [tokenInfo] = await query(`
      SELECT 
        tt.*,
        st.name as teacher_name,
        st.email as teacher_email,
        s.status as subscription_status,
        (SELECT COUNT(*) FROM teacher_parent_links WHERE teacher_token_id = tt.id AND is_active = 1) as current_children
      FROM teacher_tokens tt
      JOIN staff st ON tt.teacher_id = st.id
      JOIN subscriptions s ON tt.subscription_id = s.id
      WHERE tt.token = ? AND tt.is_active = 1 AND s.status = 'active'
    `, [teacherToken]);

    if (!tokenInfo) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired teacher token'
      });
    }

    const availableSlots = tokenInfo.max_children - tokenInfo.current_children;

    res.json({
      success: true,
      data: {
        teacherName: tokenInfo.teacher_name,
        tokenName: tokenInfo.token_name,
        maxChildren: tokenInfo.max_children,
        currentChildren: tokenInfo.current_children,
        availableSlots,
        canLink: availableSlots > 0
      }
    });

  } catch (error) {
    console.error('Error validating teacher token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate teacher token'
    });
  }
});

export default router; 