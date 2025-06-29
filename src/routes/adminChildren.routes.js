import express from 'express';
import { verifyToken, requireRole } from '../utils/security.js';
import { db } from '../db.js';

const router = express.Router();

// Admin middleware - require authentication and admin role
router.use(verifyToken);
router.use(requireRole('admin'));

// GET /api/admin/children - Get all children with pagination, search, and filtering
router.get('/', async (req, res) => {
  console.log('📊 Admin children list requested');
  
  try {
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Database not available',
        error: 'DATABASE_UNAVAILABLE'
      });
    }

    // Extract query parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const classId = req.query.classId;
    const teacherId = req.query.teacherId;

    // Build the base query
    let baseQuery = `
      FROM children c
      LEFT JOIN users parent ON c.parent_id = parent.id
      LEFT JOIN users teacher ON c.teacher_id = teacher.id
      LEFT JOIN classes cl ON c.class_id = cl.id
    `;

    // Build WHERE conditions
    let whereConditions = [];
    let queryParams = [];

    // Search functionality
    if (search) {
      whereConditions.push(`(
        c.name LIKE ? OR 
        c.surname LIKE ? OR 
        parent.name LIKE ? OR 
        parent.surname LIKE ? OR 
        teacher.name LIKE ? OR 
        teacher.surname LIKE ? OR
        cl.name LIKE ?
      )`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Filter by class
    if (classId) {
      whereConditions.push('c.class_id = ?');
      queryParams.push(classId);
    }

    // Filter by teacher
    if (teacherId) {
      whereConditions.push('c.teacher_id = ?');
      queryParams.push(teacherId);
    }

    // Combine WHERE conditions
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total ${baseQuery} ${whereClause}`;
    const [countResult] = await db.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // Get children data with pagination
    const dataQuery = `
      SELECT 
        c.id,
        c.name,
        c.surname,
        c.date_of_birth,
        c.grade,
        c.emergency_contact,
        c.medical_info,
        c.notes,
        c.parent_id,
        c.teacher_id,
        c.class_id,
        c.created_at,
        c.updated_at,
        parent.name as parent_name,
        parent.surname as parent_surname,
        parent.email as parent_email,
        parent.phone as parent_phone,
        teacher.name as teacher_name,
        teacher.surname as teacher_surname,
        teacher.email as teacher_email,
        cl.name as class_name,
        cl.description as class_description
      ${baseQuery}
      ${whereClause}
      ORDER BY c.surname, c.name
      LIMIT ? OFFSET ?
    `;

    const [children] = await db.execute(dataQuery, [...queryParams, limit, offset]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    console.log(`✅ Found ${children.length} children (page ${page}/${totalPages})`);

    res.json({
      success: true,
      data: children,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        search,
        classId,
        teacherId
      },
      message: 'Children fetched successfully'
    });

  } catch (error) {
    console.error('❌ Error fetching admin children:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch children',
      error: 'FETCH_CHILDREN_ERROR'
    });
  }
});

// GET /api/admin/children/:id - Get specific child details
router.get('/:id', async (req, res) => {
  console.log(`📊 Admin child details requested for ID: ${req.params.id}`);
  
  try {
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Database not available',
        error: 'DATABASE_UNAVAILABLE'
      });
    }

    const childId = req.params.id;

    const query = `
      SELECT 
        c.id,
        c.name,
        c.surname,
        c.date_of_birth,
        c.grade,
        c.emergency_contact,
        c.medical_info,
        c.notes,
        c.parent_id,
        c.teacher_id,
        c.class_id,
        c.created_at,
        c.updated_at,
        parent.name as parent_name,
        parent.surname as parent_surname,
        parent.email as parent_email,
        parent.phone as parent_phone,
        teacher.name as teacher_name,
        teacher.surname as teacher_surname,
        teacher.email as teacher_email,
        cl.name as class_name,
        cl.description as class_description
      FROM children c
      LEFT JOIN users parent ON c.parent_id = parent.id
      LEFT JOIN users teacher ON c.teacher_id = teacher.id
      LEFT JOIN classes cl ON c.class_id = cl.id
      WHERE c.id = ?
    `;

    const [children] = await db.execute(query, [childId]);

    if (children.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Child not found',
        error: 'CHILD_NOT_FOUND'
      });
    }

    console.log(`✅ Child details found for ID: ${childId}`);

    res.json({
      success: true,
      data: children[0],
      message: 'Child details fetched successfully'
    });

  } catch (error) {
    console.error('❌ Error fetching child details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch child details',
      error: 'FETCH_CHILD_ERROR'
    });
  }
});

export default router;
