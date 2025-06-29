import { Router } from 'express';
import { execute, query } from '../db.js';
import { authMiddleware, isAdmin } from '../middleware/authMiddleware.js';

const router = Router();

// Create a new group (admin only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description, type, members } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only admins can create groups
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can create groups'
      });
    }

    // Validate input
    if (!name || !type || !members || !Array.isArray(members)) {
      return res.status(400).json({
        success: false,
        message: 'Name, type, and members array are required'
      });
    }

    // Create the group
    const result = await execute(
      'INSERT INTO groups (name, description, type, created_by) VALUES (?, ?, ?, ?)',
      [name, description || '', type, userId],
      'skydek_DB'
    );

    const groupId = result.insertId;

    // Add members to the group
    const memberValues = members.map(member => 
      [groupId, member.userId, member.userType, member.role || 'member']
    );

    if (memberValues.length > 0) {
      await execute(
        'INSERT INTO group_members (group_id, user_id, user_type, role) VALUES ?',
        [memberValues],
        'skydek_DB'
      );
    }

    // Add creator as admin member
    await execute(
      'INSERT INTO group_members (group_id, user_id, user_type, role) VALUES (?, ?, ?, ?)',
      [groupId, userId, userRole, 'admin'],
      'skydek_DB'
    );

    res.json({
      success: true,
      groupId,
      message: 'Group created successfully'
    });

  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create group',
      error: error.message
    });
  }
});

// Get all groups for the user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.role;

    const groups = await query(
      `SELECT g.*, gm.role as member_role,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
        (SELECT COUNT(*) FROM messages WHERE group_id = g.id) as message_count
       FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = ? AND gm.user_type = ?
       ORDER BY g.updated_at DESC`,
      [userId, userType],
      'skydek_DB'
    );

    res.json({
      success: true,
      groups,
      count: groups.length
    });

  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch groups',
      error: error.message
    });
  }
});

// Get group details including members
router.get('/:groupId', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;

    // Check if user is a member of the group
    const [membership] = await query(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND user_type = ?',
      [groupId, userId, userType],
      'skydek_DB'
    );

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    // Get group details
    const [group] = await query(
      'SELECT * FROM groups WHERE id = ?',
      [groupId],
      'skydek_DB'
    );

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Get group members
    const members = await query(
      `SELECT gm.*, 
        CASE 
          WHEN gm.user_type = 'parent' THEN (SELECT name FROM users WHERE id = gm.user_id)
          ELSE (SELECT name FROM staff WHERE id = gm.user_id)
        END as name
       FROM group_members gm
       WHERE gm.group_id = ?`,
      [groupId],
      'skydek_DB'
    );

    res.json({
      success: true,
      group: {
        ...group,
        members,
        userRole: membership.role
      }
    });

  } catch (error) {
    console.error('Error fetching group details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group details',
      error: error.message
    });
  }
});

// Add members to a group (admin only)
router.post('/:groupId/members', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { members } = req.body;
    const userId = req.user.id;
    const userType = req.user.role;

    // Check if user is group admin
    const [membership] = await query(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND user_type = ?',
      [groupId, userId, userType],
      'skydek_DB'
    );

    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only group administrators can add members'
      });
    }

    // Add new members
    const memberValues = members.map(member => 
      [groupId, member.userId, member.userType, member.role || 'member']
    );

    await execute(
      'INSERT INTO group_members (group_id, user_id, user_type, role) VALUES ?',
      [memberValues],
      'skydek_DB'
    );

    res.json({
      success: true,
      message: 'Members added successfully'
    });

  } catch (error) {
    console.error('Error adding group members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add members',
      error: error.message
    });
  }
});

// Remove member from group (admin only)
router.delete('/:groupId/members/:userId/:userType', authMiddleware, async (req, res) => {
  try {
    const { groupId, userId: targetUserId, userType: targetUserType } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;

    // Check if user is group admin
    const [membership] = await query(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND user_type = ?',
      [groupId, userId, userType],
      'skydek_DB'
    );

    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only group administrators can remove members'
      });
    }

    // Remove member
    await execute(
      'DELETE FROM group_members WHERE group_id = ? AND user_id = ? AND user_type = ?',
      [groupId, targetUserId, targetUserType],
      'skydek_DB'
    );

    res.json({
      success: true,
      message: 'Member removed successfully'
    });

  } catch (error) {
    console.error('Error removing group member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove member',
      error: error.message
    });
  }
});

export default router; 