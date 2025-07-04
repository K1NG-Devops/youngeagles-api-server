const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const auth = require('../middleware/auth');

// Activity management routes
router.post('/activities', auth.requireTeacher, activityController.createActivity);
router.get('/activities/student', auth.requireAuth, activityController.getActivitiesForStudent);
router.post('/activities/assign', auth.requireTeacher, activityController.assignActivity);

// Submission routes
router.post('/submissions/:submission_id', auth.requireAuth, activityController.submitActivity);
router.post('/submissions/:submission_id/grade', auth.requireTeacher, activityController.gradeSubmission);

// Progress tracking routes
router.get('/progress/student/:student_id', auth.requireAuth, activityController.getStudentProgress);
router.get('/progress/teacher/:teacher_id', auth.requireTeacher, activityController.getTeacherOverview);

module.exports = router;
