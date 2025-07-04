const Activity = require('../models/Activity');
const ActivityContent = require('../models/ActivityContent');
const ActivitySubmission = require('../models/ActivitySubmission');
const { Op } = require('sequelize');

const activityController = {
  // Create a new activity
  async createActivity(req, res) {
    try {
      const { activity, content } = req.body;
      
      // Create the base activity
      const newActivity = await Activity.create(activity);
      
      // Create associated content
      const newContent = await ActivityContent.create({
        ...content,
        activity_id: newActivity.id
      });
      
      res.status(201).json({
        success: true,
        activity: newActivity,
        content: newContent
      });
    } catch (error) {
      console.error('Error creating activity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create activity',
        error: error.message
      });
    }
  },

  // Get activities suitable for a student
  async getActivitiesForStudent(req, res) {
    try {
      const { student_id, age, difficulty } = req.query;
      
      const activities = await Activity.findAll({
        where: {
          is_active: true,
          age_group: age,
          ...(difficulty && { difficulty })
        },
        include: [{
          model: ActivitySubmission,
          where: { student_id },
          required: false
        }]
      });

      res.json({
        success: true,
        activities
      });
    } catch (error) {
      console.error('Error fetching activities:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch activities',
        error: error.message
      });
    }
  },

  // Assign activity to students
  async assignActivity(req, res) {
    try {
      const { activity_id, student_ids, due_date, teacher_id } = req.body;

      const assignments = await Promise.all(
        student_ids.map(student_id =>
          ActivitySubmission.create({
            activity_id,
            student_id,
            teacher_id,
            due_date,
            status: 'assigned'
          })
        )
      );

      res.json({
        success: true,
        assignments
      });
    } catch (error) {
      console.error('Error assigning activity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign activity',
        error: error.message
      });
    }
  },

  // Submit activity response
  async submitActivity(req, res) {
    try {
      const { submission_id } = req.params;
      const { responses, voice_recordings } = req.body;

      const submission = await ActivitySubmission.findByPk(submission_id);
      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Update submission with student's work
      await submission.update({
        responses,
        voice_recordings,
        status: 'submitted',
        completion_time: new Date()
      });

      // TODO: Trigger AI analysis of submission

      res.json({
        success: true,
        submission
      });
    } catch (error) {
      console.error('Error submitting activity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit activity',
        error: error.message
      });
    }
  },

  // Grade activity submission
  async gradeSubmission(req, res) {
    try {
      const { submission_id } = req.params;
      const { assessment_scores, teacher_feedback, total_score } = req.body;

      const submission = await ActivitySubmission.findByPk(submission_id);
      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      await submission.update({
        assessment_scores,
        teacher_feedback,
        total_score,
        status: 'graded'
      });

      res.json({
        success: true,
        submission
      });
    } catch (error) {
      console.error('Error grading submission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to grade submission',
        error: error.message
      });
    }
  },

  // Get activity progress for a student
  async getStudentProgress(req, res) {
    try {
      const { student_id } = req.params;

      const submissions = await ActivitySubmission.findAll({
        where: { student_id },
        include: [{
          model: Activity,
          attributes: ['title', 'type', 'difficulty']
        }]
      });

      const progress = {
        total_activities: submissions.length,
        completed: submissions.filter(s => s.status === 'graded').length,
        in_progress: submissions.filter(s => s.status === 'in_progress').length,
        average_score: submissions.reduce((acc, s) => acc + (s.total_score || 0), 0) / submissions.length,
        recent_submissions: submissions.slice(0, 5)
      };

      res.json({
        success: true,
        progress
      });
    } catch (error) {
      console.error('Error fetching student progress:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch student progress',
        error: error.message
      });
    }
  },

  // Get teacher's class activity overview
  async getTeacherOverview(req, res) {
    try {
      const { teacher_id } = req.params;

      const submissions = await ActivitySubmission.findAll({
        where: { teacher_id },
        include: [
          {
            model: Activity,
            attributes: ['title', 'type', 'difficulty']
          },
          {
            model: Student,
            attributes: ['id', 'first_name', 'last_name']
          }
        ]
      });

      const overview = {
        total_assignments: submissions.length,
        pending_grading: submissions.filter(s => s.status === 'submitted').length,
        graded: submissions.filter(s => s.status === 'graded').length,
        class_average: submissions.reduce((acc, s) => acc + (s.total_score || 0), 0) / submissions.length,
        recent_submissions: submissions
          .filter(s => s.status === 'submitted')
          .slice(0, 5)
      };

      res.json({
        success: true,
        overview
      });
    } catch (error) {
      console.error('Error fetching teacher overview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch teacher overview',
        error: error.message
      });
    }
  }
};

module.exports = activityController;
