import { Router } from 'express';
import { authMiddleware, isTeacher } from '../middleware/authMiddleware.js';
import { query } from '../db.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for profile picture uploads
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/profiles/');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `teacher-${req.user.id}-${Date.now()}${ext}`);
  }
});

const uploadProfilePicture = multer({ 
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const router = Router();

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Teacher routes are working',
    timestamp: new Date().toISOString()
  });
});

// Get all teachers (for messaging contacts)
router.get('/', async (req, res) => {
  try {
    console.log('📚 GET /teacher - Fetching all teachers for messaging contacts');
    
    // Get all active teachers and administrators
    const teachers = await query(
      `SELECT id, name, email, role, className 
       FROM staff 
       WHERE role IN ('teacher', 'admin', 'administrator') 
       AND status = 'active'
       ORDER BY role, name`,
      [],
      'skydek_DB'
    );

    console.log(`✅ Found ${teachers.length} teachers/admins:`, teachers.map(t => ({ name: t.name, role: t.role })));

    res.json({
      success: true,
      teachers: teachers.map(teacher => ({
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        role: teacher.role === 'admin' || teacher.role === 'administrator' ? 'Administrator' : 'Teacher',
        className: teacher.className || 'All Classes',
        isOnline: Math.random() > 0.3 // Random online status for demo
      })),
      total: teachers.length,
      message: 'Teachers fetched successfully'
    });
    
  } catch (error) {
    console.error('❌ Error fetching teachers:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching teachers',
      error: error.message,
      teachers: [] // Return empty array on error
    });
  }
});

// Get teacher's classes and info
router.get('/classes', authMiddleware, async (req, res) => {
  try {
    const teacherId = req.user?.id;
    
    if (!teacherId) {
      return res.status(400).json({ 
        success: false,
        message: 'Teacher ID required' 
      });
    }

    // Get teacher's class assignment from staff table
    const teacherRows = await query(
      'SELECT className, name, email FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Teacher not found' 
      });
    }

    const teacher = teacherRows[0];
    
    // Get students in teacher's class
    let students = [];
    if (teacher.className) {
      students = await query(
        'SELECT id, name, age, grade FROM children WHERE className = ?',
        [teacher.className],
        'skydek_DB'
      );
    }

    res.json({
      success: true,
      teacher: {
        id: teacherId,
        name: teacher.name,
        email: teacher.email,
        className: teacher.className
      },
      students: students,
      totalStudents: students.length,
      message: 'Teacher classes fetched successfully'
    });
    
  } catch (error) {
    console.error('Error in teacher classes endpoint:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching classes',
      error: error.message 
    });
  }
});

// Get homework assigned by teacher
router.get('/homework', authMiddleware, async (req, res) => {
  try {
    const teacherId = req.user?.id;
    
    if (!teacherId) {
      return res.status(400).json({ 
        success: false,
        message: 'Teacher ID required' 
      });
    }

    // Get teacher's class first
    const teacherRows = await query(
      'SELECT className FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Teacher not found' 
      });
    }

    const teacherClass = teacherRows[0].className;

    // Get homework assigned by this teacher
    const homework = await query(
      'SELECT id, title, instructions, due_date, status, class_name, grade, created_at FROM homeworks WHERE uploaded_by_teacher_id = ? ORDER BY created_at DESC',
      [teacherId],
      'skydek_DB'
    );

    // Get submission count for each homework
    const homeworkWithStats = await Promise.all(homework.map(async (hw) => {
      const submissions = await query(
        'SELECT COUNT(*) as count FROM homework_submissions WHERE homework_id = ?',
        [hw.id],
        'skydek_DB'
      );
      
      return {
        ...hw,
        submissionCount: submissions[0]?.count || 0
      };
    }));

    res.json({
      success: true,
      homework: homeworkWithStats,
      totalHomework: homework.length,
      teacherClass: teacherClass,
      message: 'Teacher homework fetched successfully'
    });
    
  } catch (error) {
    console.error('Error in teacher homework endpoint:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching homework',
      error: error.message 
    });
  }
});

// Get teacher statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const teacherId = req.user?.id;
    
    if (!teacherId) {
      return res.status(400).json({ 
        success: false,
        message: 'Teacher ID required' 
      });
    }

    // Get teacher's class
    const teacherRows = await query(
      'SELECT className FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Teacher not found' 
      });
    }

    const teacherClass = teacherRows[0].className;

    // Get homework count
    const homeworkCount = await query(
      'SELECT COUNT(*) as count FROM homeworks WHERE uploaded_by_teacher_id = ?',
      [teacherId],
      'skydek_DB'
    );

    // Get submission count for teacher's homework
    const submissionCount = await query(
      `SELECT COUNT(*) as count FROM homework_submissions hs 
       JOIN homeworks h ON hs.homework_id = h.id 
       WHERE h.uploaded_by_teacher_id = ?`,
      [teacherId],
      'skydek_DB'
    );

    // Get student count in teacher's class
    const studentCount = await query(
      'SELECT COUNT(*) as count FROM children WHERE className = ?',
      [teacherClass || ''],
      'skydek_DB'
    );

    // Calculate submission rate
    const totalHomework = homeworkCount[0]?.count || 0;
    const totalSubmissions = submissionCount[0]?.count || 0;
    const totalStudents = studentCount[0]?.count || 0;
    const submissionRate = totalHomework > 0 && totalStudents > 0 ? 
      (totalSubmissions / (totalHomework * totalStudents)) * 100 : 0;

    res.json({
      success: true,
      stats: {
        totalHomework: totalHomework,
        totalSubmissions: totalSubmissions,
        totalStudents: totalStudents,
        submissionRate: Math.min(100, submissionRate)
      },
      teacherClass: teacherClass,
      message: 'Teacher stats fetched successfully'
    });
    
  } catch (error) {
    console.error('Error in teacher stats endpoint:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching stats',
      error: error.message 
    });
  }
});

// Get attendance for teacher's classes (simplified)
router.get('/attendance', authMiddleware, async (req, res) => {
  try {
    const teacherId = req.user?.id;
    
    if (!teacherId) {
      return res.status(400).json({ 
        success: false,
        message: 'Teacher ID required' 
      });
    }

    // Get teacher's class
    const teacherRows = await query(
      'SELECT className FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Teacher not found' 
      });
    }

    const teacherClass = teacherRows[0].className;

    // Get recent attendance records for teacher's class
    const attendance = await query(
      `SELECT a.*, c.name as child_name 
       FROM attendance a 
       JOIN children c ON a.child_id = c.id 
       WHERE c.className = ? 
       ORDER BY a.date DESC 
       LIMIT 50`,
      [teacherClass || ''],
      'skydek_DB'
    );

    res.json({
      success: true,
      attendance: attendance,
      teacherClass: teacherClass,
      message: 'Teacher attendance fetched successfully'
    });
    
  } catch (error) {
    console.error('Error in teacher attendance endpoint:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching attendance',
      error: error.message 
    });
  }
});

// Get teacher profile
router.get('/profile', authMiddleware, isTeacher, async (req, res) => {
  try {
    const teacherId = req.user?.id;
    
    console.log('📋 GET /teacher/profile - Getting teacher profile for ID:', teacherId);
    
    if (!teacherId) {
      return res.status(400).json({ 
        success: false,
        message: 'Teacher ID required' 
      });
    }

    // Get teacher profile from staff table
    const teacherRows = await query(
      'SELECT id, name, email, phone, className, profilePicture, bio, joinDate, status FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Teacher not found' 
      });
    }

    const teacher = teacherRows[0];
    
    // Get student count in teacher's class
    const studentCount = await query(
      'SELECT COUNT(*) as count FROM children WHERE className = ?',
      [teacher.className || ''],
      'skydek_DB'
    );

    // Get homework count
    const homeworkCount = await query(
      'SELECT COUNT(*) as count FROM homeworks WHERE uploaded_by_teacher_id = ?',
      [teacherId],
      'skydek_DB'
    );

    const profile = {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone || '',
      className: teacher.className || '',
      profilePicture: teacher.profilePicture || null,
      bio: teacher.bio || '',
      joinDate: teacher.joinDate || null,
      status: teacher.status || 'active',
      stats: {
        totalStudents: studentCount[0]?.count || 0,
        totalHomework: homeworkCount[0]?.count || 0
      }
    };

    console.log('✅ Teacher profile fetched successfully:', { name: profile.name, className: profile.className });

    res.json({
      success: true,
      teacher: profile,
      message: 'Teacher profile fetched successfully'
    });
    
  } catch (error) {
    console.error('❌ Error fetching teacher profile:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching teacher profile',
      error: error.message 
    });
  }
});

// Update teacher profile
router.put('/profile', authMiddleware, isTeacher, async (req, res) => {
  try {
    const teacherId = req.user?.id;
    const { name, email, phone, bio } = req.body;
    
    console.log('✏️ PUT /teacher/profile - Updating teacher profile:', { teacherId, name, email });
    
    if (!teacherId) {
      return res.status(400).json({ 
        success: false,
        message: 'Teacher ID required' 
      });
    }

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ 
        success: false,
        message: 'Name and email are required' 
      });
    }

    // Check if teacher exists
    const existingTeacher = await query(
      'SELECT id FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (existingTeacher.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Teacher not found' 
      });
    }

    // Check if email is already taken by another teacher
    const emailCheck = await query(
      'SELECT id FROM staff WHERE email = ? AND id != ? AND role = "teacher"',
      [email, teacherId],
      'skydek_DB'
    );

    if (emailCheck.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is already taken by another teacher' 
      });
    }

    // Update teacher profile
    await query(
      'UPDATE staff SET name = ?, email = ?, phone = ?, bio = ? WHERE id = ? AND role = "teacher"',
      [name, email, phone || null, bio || null, teacherId],
      'skydek_DB'
    );

    // Fetch updated profile
    const updatedTeacher = await query(
      'SELECT id, name, email, phone, className, profilePicture, bio, joinDate, status FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    const profile = {
      id: updatedTeacher[0].id,
      name: updatedTeacher[0].name,
      email: updatedTeacher[0].email,
      phone: updatedTeacher[0].phone || '',
      className: updatedTeacher[0].className || '',
      profilePicture: updatedTeacher[0].profilePicture || null,
      bio: updatedTeacher[0].bio || '',
      joinDate: updatedTeacher[0].joinDate || null,
      status: updatedTeacher[0].status || 'active'
    };

    console.log('✅ Teacher profile updated successfully:', { name: profile.name });

    res.json({
      success: true,
      teacher: profile,
      message: 'Teacher profile updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Error updating teacher profile:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating teacher profile',
      error: error.message 
    });
  }
});

// Upload teacher profile picture
router.post('/profile/upload-picture', authMiddleware, isTeacher, uploadProfilePicture.single('profilePicture'), async (req, res) => {
  try {
    const teacherId = req.user?.id;
    
    console.log('📸 POST /teacher/profile/upload-picture - Uploading profile picture for teacher:', teacherId);
    
    if (!teacherId) {
      return res.status(400).json({ 
        success: false,
        message: 'Teacher ID required' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }

    // Check if teacher exists
    const existingTeacher = await query(
      'SELECT id, profilePicture FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (existingTeacher.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Teacher not found' 
      });
    }

    // Delete old profile picture if it exists
    const oldProfilePicture = existingTeacher[0].profilePicture;
    if (oldProfilePicture) {
      const oldFilePath = path.join(__dirname, '../uploads/profiles/', path.basename(oldProfilePicture));
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath);
          console.log('🗑️ Deleted old profile picture:', oldFilePath);
        } catch (err) {
          console.warn('⚠️ Could not delete old profile picture:', err.message);
        }
      }
    }

    // Generate the URL for the uploaded file
    const profilePictureUrl = `/uploads/profiles/${req.file.filename}`;

    // Update teacher's profile picture in database
    await query(
      'UPDATE staff SET profilePicture = ? WHERE id = ? AND role = "teacher"',
      [profilePictureUrl, teacherId],
      'skydek_DB'
    );

    console.log('✅ Profile picture uploaded successfully:', { teacherId, filename: req.file.filename });

    res.json({
      success: true,
      profilePicture: profilePictureUrl,
      message: 'Profile picture uploaded successfully'
    });
    
  } catch (error) {
    console.error('❌ Error uploading profile picture:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.error('❌ Error cleaning up uploaded file:', cleanupErr);
      }
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Error uploading profile picture',
      error: error.message 
    });
  }
});

export default router;
