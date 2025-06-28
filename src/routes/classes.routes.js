import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { body, validationResult, param, query } from 'express-validator';

const router = Router();

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Classes routes are working',
    timestamp: new Date().toISOString()
  });
});

// Get all classes
router.get('/', authMiddleware, async (req, res) => {
  console.log('🏫 Classes list requested');
  
  try {
    // For now, return mock data until database is fully configured
    const mockClasses = [
      {
        id: 1,
        name: 'Panda',
        description: 'Pre-K class for ages 4-5',
        teacher_name: 'Mrs. Smith',
        teacher_id: 1,
        age_group: '4-5 years',
        max_students: 20,
        student_count: 15,
        schedule: 'Mon-Fri 8:00-15:00'
      },
      {
        id: 2,
        name: 'Curious Cubs',
        description: 'Toddler class for ages 2-3',
        teacher_name: 'Mrs. Brown',
        teacher_id: 2,
        age_group: '2-3 years',
        max_students: 15,
        student_count: 12,
        schedule: 'Mon-Fri 9:00-14:00'
      },
      {
        id: 3,
        name: 'Little Explorers',
        description: 'Nursery class for ages under 2',
        teacher_name: 'Mrs. Johnson',
        teacher_id: 3,
        age_group: 'Under 2 years',
        max_students: 10,
        student_count: 8,
        schedule: 'Mon-Fri 8:30-14:30'
      }
    ];

    console.log(`✅ Returning ${mockClasses.length} mock classes`);

    res.json({
      success: true,
      data: mockClasses
    });

  } catch (error) {
    console.error('❌ Classes list error:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: 'INTERNAL_ERROR'
    });
  }
});

// Get single class by ID
router.get('/:id', [
  param('id').isInt().withMessage('Class ID must be an integer')
], authMiddleware, async (req, res) => {
  console.log('🏫 Single class requested');
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }

  try {
    const { id } = req.params;
    
    // For now, return mock data until database is fully configured
    const mockClass = {
      id: parseInt(id),
      name: 'Panda',
      description: 'Pre-K class for ages 4-5',
      teacher_name: 'Mrs. Smith',
      teacher_email: 'mrs.smith@youngeagles.org.za',
      teacher_id: 1,
      age_group: '4-5 years',
      max_students: 20,
      student_count: 15,
      schedule: 'Mon-Fri 8:00-15:00',
      students: [
        {
          id: 1,
          name: 'Emma Johnson',
          age: 4,
          parent_name: 'John Johnson',
          parent_email: 'john@example.com'
        },
        {
          id: 2,
          name: 'Liam Smith',
          age: 5,
          parent_name: 'Sarah Smith',
          parent_email: 'sarah@example.com'
        }
      ]
    };

    console.log(`✅ Returning mock class data for ID ${id}`);

    res.json({
      success: true,
      data: mockClass
    });

  } catch (error) {
    console.error('❌ Single class error:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: 'INTERNAL_ERROR'
    });
  }
});

// Create new class
router.post('/', [
  body('name').trim().notEmpty().withMessage('Class name is required'),
  body('description').optional().trim(),
  body('teacher_id').optional().isInt().withMessage('Teacher ID must be an integer'),
  body('age_group').optional().trim(),
  body('max_students').optional().isInt({ min: 1 }).withMessage('Max students must be a positive integer'),
  body('schedule').optional().trim()
], authMiddleware, async (req, res) => {
  console.log('🏫 Create class requested');
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }

  try {
    const { name, description, teacher_id, age_group, max_students, schedule } = req.body;

    // For now, return mock response until database is fully configured
    const mockNewClass = {
      id: Date.now(), // Use timestamp as mock ID
      name: name.trim(),
      description: description || '',
      teacher_id: teacher_id || null,
      teacher_name: teacher_id ? 'Assigned Teacher' : null,
      age_group: age_group || '',
      max_students: max_students || 20,
      student_count: 0,
      schedule: schedule || '',
      created_at: new Date().toISOString()
    };

    console.log(`✅ Mock class created: ${name}`);

    res.status(201).json({
      success: true,
      data: mockNewClass,
      message: 'Class created successfully (mock)'
    });

  } catch (error) {
    console.error('❌ Create class error:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: 'INTERNAL_ERROR'
    });
  }
});

// Get available teachers for assignment
router.get('/teachers/available', authMiddleware, async (req, res) => {
  console.log('👩‍🏫 Available teachers requested');
  
  try {
    // For now, return mock data until database is fully configured
    const mockTeachers = [
      {
        id: 1,
        name: 'Mrs. Smith',
        email: 'mrs.smith@youngeagles.org.za'
      },
      {
        id: 2,
        name: 'Mrs. Brown',
        email: 'mrs.brown@youngeagles.org.za'
      },
      {
        id: 3,
        name: 'Mrs. Johnson',
        email: 'mrs.johnson@youngeagles.org.za'
      }
    ];

    console.log(`✅ Returning ${mockTeachers.length} mock teachers`);

    res.json({
      success: true,
      data: mockTeachers
    });

  } catch (error) {
    console.error('❌ Available teachers error:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: 'INTERNAL_ERROR'
    });
  }
});

export default router; 