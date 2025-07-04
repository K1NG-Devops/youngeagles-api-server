const { DataTypes } = require('sequelize');
const db = require('../db');

const Activity = db.define('Activity', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('pattern_detective', 'story_problem', 'sorting_lab', 'if_then_adventure', 'mystery_box'),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  age_group: {
    type: DataTypes.STRING,
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER, // in minutes
    allowNull: false
  },
  difficulty: {
    type: DataTypes.ENUM('beginner', 'intermediate', 'advanced'),
    allowNull: false
  },
  instructions: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  objectives: {
    type: DataTypes.JSON, // Array of learning objectives
    allowNull: false
  },
  assessment_criteria: {
    type: DataTypes.JSON,
    allowNull: false
  },
  digital_resources: {
    type: DataTypes.JSON, // Required digital tools/resources
    allowNull: false
  },
  parent_instructions: {
    type: DataTypes.TEXT
  },
  teacher_notes: {
    type: DataTypes.TEXT
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

module.exports = Activity;
