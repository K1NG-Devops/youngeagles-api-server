import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authMiddleware, isTeacher } from '../middleware/authMiddleware.js';
import { query, execute } from '../db.js';
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
        message: 'Teacher not found or not assigned to any class' 
      });
    }

    const teacherClass = teacherRows[0].className;
    
    // Handle case where teacher has no class assigned
    if (!teacherClass) {
      console.log(`⚠️ Teacher ${teacherId} has no class assigned`);
      return res.json({
        success: true,
        stats: {
          totalHomework: 0,
          totalSubmissions: 0,
          totalStudents: 0,
          submissionRate: 0
        },
        teacherClass: null,
        message: 'No class assigned to teacher'
      });
    }

    // Get homework count
    const homeworkCount = await query(
      'SELECT COUNT(*) as count FROM homeworks WHERE uploaded_by_teacher_id = ?',
      [teacherId],
      'skydek_DB'
    );

    // Get submission count for teacher's homework (using correct table name)
    const submissionCount = await query(
      `SELECT COUNT(*) as count FROM submissions s 
       JOIN homeworks h ON s.homework_id = h.id 
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
    console.error('Full error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      success: false,
      message: 'Error fetching stats',
      error: error.message,
      details: error.sqlMessage || 'Database connection error'
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

    // Get teacher profile from staff table with all fields
    const teacherRows = await query(
      `SELECT id, name, email, phone, className, bio, 
              qualification, specialization, experience_years, 
              emergency_contact_name, emergency_contact_phone, 
              profile_picture, created_at, updated_at
       FROM staff WHERE id = ? AND role = "teacher"`,
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
      profilePicture: teacher.profilePicture || teacher.profile_picture || null,
      bio: teacher.bio || '',
      joinDate: teacher.joinDate || teacher.created_at || null,
      status: teacher.status || 'active',
      qualification: teacher.qualification || '',
      specialization: teacher.specialization || '',
      experienceYears: teacher.experience_years || null,
      emergencyContactName: teacher.emergency_contact_name || '',
      emergencyContactPhone: teacher.emergency_contact_phone || '',
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
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const teacherId = req.user?.id;
    
    if (!teacherId) {
      return res.status(400).json({ 
        success: false,
        message: 'Teacher ID required' 
      });
    }

    const {
      name,
      phone,
      qualification,
      specialization,
      bio,
      experience_years,
      emergency_contact_name,
      emergency_contact_phone
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    // Update teacher profile
    await execute(
      `UPDATE staff SET 
       name = ?, 
       phone = ?, 
       qualification = ?, 
       specialization = ?, 
       bio = ?, 
       experience_years = ?, 
       emergency_contact_name = ?, 
       emergency_contact_phone = ?, 
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND role = "teacher"`,
      [
        name,
        phone || null,
        qualification || null,
        specialization || null,
        bio || null,
        experience_years || null,
        emergency_contact_name || null,
        emergency_contact_phone || null,
        teacherId
      ],
      'skydek_DB'
    );

    // Fetch updated profile
    const updatedProfile = await query(
      `SELECT id, name, email, role, className, qualification, 
              specialization, bio, phone, experience_years, 
              emergency_contact_name, emergency_contact_phone, 
              profile_picture, created_at, updated_at
       FROM staff WHERE id = ? AND role = "teacher"`,
      [teacherId],
      'skydek_DB'
    );

    res.json({
      success: true,
      profile: updatedProfile[0],
      message: 'Profile updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating teacher profile:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating profile',
      error: error.message 
    });
  }
});

// Change teacher password
router.put('/profile/password', authMiddleware, async (req, res) => {
  try {
    const teacherId = req.user?.id;
    const { currentPassword, newPassword } = req.body;
    
    if (!teacherId) {
      return res.status(400).json({ 
        success: false,
        message: 'Teacher ID required' 
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Validate new password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters with uppercase, lowercase, numbers, and special characters'
      });
    }

    // Get current password hash
    const teacherRows = await query(
      'SELECT password FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Teacher not found' 
      });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, teacherRows[0].password);
    if (!validPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await execute(
      'UPDATE staff SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role = "teacher"',
      [hashedNewPassword, teacherId],
      'skydek_DB'
    );

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating teacher password:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating password',
      error: error.message 
    });
  }
});

// Enhanced Student Report System Routes
router.post('/student-reports/:studentId/generate-pdf', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { reportData, pdfBase64 } = req.body;
    const teacherId = req.user.id;

    // Verify teacher has access to this student
    const [student] = await query(
      'SELECT className FROM children WHERE id = ?',
      [studentId],
      'skydek_DB'
    );
    
    const [teacher] = await query(
      'SELECT className FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (!student || !teacher || student.className !== teacher.className) {
      return res.status(403).json({ error: 'Not authorized to create reports for this student' });
    }

    // Save report to database
    const reportSql = `
      INSERT INTO student_reports (
        student_id, teacher_id, report_data, pdf_base64, 
        reporting_period, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const result = await execute(reportSql, [
      studentId,
      teacherId,
      JSON.stringify(reportData),
      pdfBase64,
      reportData.reportingPeriod || 'Current Period'
    ], 'skydek_DB');

    res.json({
      success: true,
      reportId: result.insertId,
      message: 'Report saved to student profile successfully'
    });

  } catch (error) {
    console.error('Error saving student report:', error);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

router.post('/student-reports/:studentId/generate-homework', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { assessmentArea, homeworkTemplates } = req.body;
    const teacherId = req.user.id;

    // Verify teacher authorization
    const [student] = await query(
      'SELECT className, name FROM children WHERE id = ?',
      [studentId],
      'skydek_DB'
    );
    
    const [teacher] = await query(
      'SELECT className FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (!student || !teacher || student.className !== teacher.className) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Save generated homework to library
    const homeworkInserts = homeworkTemplates.map(template => [
      template.title,
      template.description,
      template.instructions,
      JSON.stringify(template.skills),
      JSON.stringify(template.materials),
      template.estimatedTime,
      assessmentArea,
      studentId,
      teacherId,
      new Date().toISOString(),
      'library'
    ]);

    if (homeworkInserts.length > 0) {
      const sql = `
        INSERT INTO homework_library (
          title, description, instructions, skills, materials, 
          estimated_time, assessment_area, student_id, teacher_id, 
          created_at, status
        ) VALUES ${homeworkInserts.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
      `;
      
      await execute(sql, homeworkInserts.flat(), 'skydek_DB');
    }

    res.json({
      success: true,
      message: `Generated ${homeworkTemplates.length} homework activities`,
      homeworkCount: homeworkTemplates.length
    });

  } catch (error) {
    console.error('Error generating homework:', error);
    res.status(500).json({ error: 'Failed to generate homework' });
  }
});

router.get('/student-analytics/:studentId', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;
    const teacherId = req.user.id;

    // Verify teacher authorization
    const [student] = await query(
      'SELECT className, name FROM children WHERE id = ?',
      [studentId],
      'skydek_DB'
    );
    
    const [teacher] = await query(
      'SELECT className FROM staff WHERE id = ? AND role = "teacher"',
      [teacherId],
      'skydek_DB'
    );

    if (!student || !teacher || student.className !== teacher.className) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get homework completion data
    const homeworkStats = await query(
      `SELECT 
        COUNT(*) as total_assigned,
        SUM(CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END) as completed,
        AVG(CASE WHEN ha.overall_score IS NOT NULL THEN ha.overall_score ELSE 0 END) as avg_score
       FROM homeworks h
       LEFT JOIN submissions s ON h.id = s.homework_id AND s.child_id = ?
       LEFT JOIN homework_assessments ha ON h.id = ha.homework_id AND ha.student_id = ?
       WHERE h.class_name = ?`,
      [studentId, studentId, student.className],
      'skydek_DB'
    );

    // Get skill progress data
    const skillProgress = await query(
      `SELECT 
        sc.name as category,
        AVG(ssp.proficiency_level) as avg_level,
        COUNT(ssp.id) as skill_count
       FROM student_skill_progress ssp
       JOIN skills s ON ssp.skill_id = s.id
       JOIN skill_categories sc ON s.category_id = sc.id
       WHERE ssp.student_id = ?
       GROUP BY sc.name`,
      [studentId],
      'skydek_DB'
    );

    // Get recent improvements
    const recentProgress = await query(
      `SELECT teacher_notes, demonstration_date
       FROM student_skill_progress 
       WHERE student_id = ? AND teacher_notes IS NOT NULL
       ORDER BY demonstration_date DESC 
       LIMIT 5`,
      [studentId],
      'skydek_DB'
    );

    const stats = homeworkStats[0] || { total_assigned: 0, completed: 0, avg_score: 0 };
    const completionRate = stats.total_assigned > 0 ? 
      Math.round((stats.completed / stats.total_assigned) * 100) : 0;

    const analytics = {
      totalHomeworkAssigned: stats.total_assigned,
      homeworkCompleted: stats.completed,
      completionRate: completionRate,
      averageScore: Math.round(stats.avg_score || 0),
      skillProgress: {},
      recentImprovements: recentProgress.map(p => p.teacher_notes).filter(Boolean)
    };

    // Format skill progress
    skillProgress.forEach(skill => {
      analytics.skillProgress[skill.category] = {
        current: Math.round(skill.avg_level || 1),
        target: 5,
        progress: Math.round(((skill.avg_level || 1) / 5) * 100)
      };
    });

    res.json({
      success: true,
      analytics: analytics,
      studentName: student.name
    });

  } catch (error) {
    console.error('Error fetching student analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.post('/homework-library/:homeworkId/send-to-parent', authMiddleware, async (req, res) => {
  try {
    const { homeworkId } = req.params;
    const teacherId = req.user.id;

    // Get homework details
    const [homework] = await query(
      'SELECT * FROM homework_library WHERE id = ? AND teacher_id = ?',
      [homeworkId, teacherId],
      'skydek_DB'
    );

    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }

    // Get student and parent info
    const [student] = await query(
      'SELECT c.*, u.email as parent_email FROM children c JOIN users u ON c.parent_id = u.id WHERE c.id = ?',
      [homework.student_id],
      'skydek_DB'
    );

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Create homework assignment
    const assignmentSql = `
      INSERT INTO homeworks (
        title, instructions, class_name, uploaded_by_teacher_id, 
        status, due_date, created_at
      ) VALUES (?, ?, ?, ?, 'Pending', DATE_ADD(NOW(), INTERVAL 7 DAY), NOW())
    `;

    const result = await execute(assignmentSql, [
      homework.title,
      homework.instructions,
      student.className,
      teacherId
    ], 'skydek_DB');

    // TODO: Send notification to parent via messaging system
    // await sendHomeworkNotification(student.parent_email, homework.title, student.name);

    res.json({
      success: true,
      message: `Homework "${homework.title}" sent to ${student.name}'s parent`,
      assignmentId: result.insertId
    });

  } catch (error) {
    console.error('Error sending homework to parent:', error);
    res.status(500).json({ error: 'Failed to send homework' });
  }
});

// Get children for a specific teacher
router.get('/:teacherId/children', [authMiddleware, isTeacher], async (req, res) => {
  const { teacherId } = req.params;
  console.log(`🧑‍🏫 Children for teacher ${teacherId} requested by user ${req.user.id}`);

  // Ensure the authenticated teacher is only requesting their own students
  if (req.user.id !== parseInt(teacherId)) {
    return res.status(403).json({ success: false, message: "Forbidden: You can only access your own class's students." });
  }

  try {
    // First, find the teacher's class name from the staff table
    const [teacher] = await query('SELECT className FROM staff WHERE id = ?', [teacherId]);

    if (!teacher || !teacher.className) {
      console.log(`⚠️ Teacher ${teacherId} not found or has no class assigned.`);
      return res.status(404).json({ success: false, message: 'Teacher not found or no class assigned.' });
    }

    // Now, fetch all children in that class
    const children = await query('SELECT * FROM children WHERE className = ?', [teacher.className]);

    console.log(`✅ Found ${children.length} children in class '${teacher.className}' for teacher ${teacherId}.`);
    res.json({ success: true, data: children });

  } catch (error) {
    console.error(`❌ Error fetching children for teacher ${teacherId}:`, error);
    res.status(500).json({ success: false, message: 'Failed to fetch children.' });
  }
});

// THIS IS THE CORRECTED ROUTE
router.get('/children/teacher/:teacherId', [authMiddleware, isTeacher], async (req, res) => {
  const { teacherId } = req.params;
  console.log(`🧑‍🏫 Children for teacher ${teacherId} requested by user ${req.user.id}`);

  // Ensure the authenticated teacher is only requesting their own students
  if (req.user.id !== parseInt(teacherId)) {
    return res.status(403).json({ success: false, message: "Forbidden: You can only access your own class's students." });
  }

  try {
    // First, find the teacher's class name from the staff table
    const [teacher] = await query('SELECT className FROM staff WHERE id = ?', [teacherId]);

    if (!teacher || !teacher.className) {
      console.log(`⚠️ Teacher ${teacherId} not found or has no class assigned.`);
      return res.status(404).json({ success: false, message: 'Teacher not found or no class assigned.' });
    }

    // Now, fetch all children in that class
    const children = await query('SELECT * FROM children WHERE className = ?', [teacher.className]);

    console.log(`✅ Found ${children.length} children in class '${teacher.className}' for teacher ${teacherId}.`);
    res.json({ success: true, data: children });

  } catch (error) {
    console.error(`❌ Error fetching children for teacher ${teacherId}:`, error);
    res.status(500).json({ success: false, message: 'Failed to fetch children.' });
  }
});

// Get homework for a specific teacher
router.get('/:teacherId/homework', [authMiddleware, isTeacher], async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    // Ensure the authenticated teacher is only requesting their own homework
    if (req.user.id.toString() !== teacherId) {
      return res.status(403).json({ 
        success: false,
        message: 'You can only view your own homework assignments' 
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
      `SELECT 
        h.id, h.title, h.instructions, h.due_date, h.status, h.class_name, h.grade, h.created_at,
        (SELECT COUNT(*) FROM submissions s WHERE s.homework_id = h.id) as submission_count,
        (SELECT COUNT(*) FROM children c WHERE c.className = h.class_name) as total_students
      FROM homeworks h 
      WHERE h.uploaded_by_teacher_id = ? 
      ORDER BY h.created_at DESC`,
      [teacherId],
      'skydek_DB'
    );

    // Format homework data for frontend
    const formattedHomework = homework.map(hw => ({
      id: hw.id,
      title: hw.title,
      instructions: hw.instructions,
      dueDate: hw.due_date,
      status: hw.status,
      className: hw.class_name,
      grade: hw.grade,
      createdAt: hw.created_at,
      submissionCount: parseInt(hw.submission_count) || 0,
      totalStudents: parseInt(hw.total_students) || 0,
      completionRate: hw.total_students > 0 ? Math.round((hw.submission_count / hw.total_students) * 100) : 0
    }));

    res.json({
      success: true,
      homework: formattedHomework,
      totalHomework: formattedHomework.length,
      teacherClass: teacherClass,
      message: 'Teacher homework fetched successfully'
    });
    
  } catch (error) {
    console.error('Error fetching teacher homework:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching homework',
      error: error.message 
    });
  }
});

export default router;
