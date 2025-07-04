const { DataTypes } = require('sequelize');
const db = require('../db');

const ActivitySubmission = db.define('ActivitySubmission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  activity_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Activities',
      key: 'id'
    }
  },
  student_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Students',
      key: 'id'
    }
  },
  teacher_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Teachers',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('assigned', 'in_progress', 'submitted', 'graded'),
    defaultValue: 'assigned'
  },
  start_time: {
    type: DataTypes.DATE
  },
  completion_time: {
    type: DataTypes.DATE
  },
  responses: {
    type: DataTypes.JSON, // Student's answers/work
    allowNull: true
  },
  voice_recordings: {
    type: DataTypes.JSON, // URLs to voice recordings
    allowNull: true
  },
  assessment_scores: {
    type: DataTypes.JSON, // Scores for each assessment criteria
    allowNull: true
  },
  teacher_feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  total_score: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  ai_analysis: {
    type: DataTypes.JSON, // AI-generated analysis of performance
    allowNull: true
  },
  attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  due_date: {
    type: DataTypes.DATE,
    allowNull: false
  }
});

// Add associations
ActivitySubmission.associate = (models) => {
  ActivitySubmission.belongsTo(models.Activity);
  ActivitySubmission.belongsTo(models.Student);
  ActivitySubmission.belongsTo(models.Teacher);
};

module.exports = ActivitySubmission;
