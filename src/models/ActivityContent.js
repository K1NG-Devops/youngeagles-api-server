const { DataTypes } = require('sequelize');
const db = require('../db');

const ActivityContent = db.define('ActivityContent', {
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
  content_type: {
    type: DataTypes.ENUM('pattern', 'story', 'sorting', 'adventure', 'mystery'),
    allowNull: false
  },
  content_data: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Activity-specific content structured based on type'
  },
  resources: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'URLs to images, audio, or other media resources'
  },
  hints: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Progressive hints for students'
  },
  solution: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Correct answers or solution criteria'
  },
  ai_prompts: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Prompts for AI analysis of student responses'
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false
  }
});

// Example content structures for different activity types
const contentStructures = {
  pattern: {
    patterns: [
      {
        sequence: [], // Array of elements in the pattern
        missing_index: 0, // Position of missing element
        options: [], // Available options for answer
        difficulty: 'beginner'
      }
    ]
  },
  story: {
    scenarios: [
      {
        story_text: '',
        question: '',
        options: [], // Array of possible solutions
        consequences: {} // Mapping of choices to outcomes
      }
    ]
  },
  sorting: {
    categories: [
      {
        name: '',
        items: [], // Items that belong in this category
        attributes: [] // Key attributes for this category
      }
    ],
    items: [] // All items available for sorting
  },
  adventure: {
    scenes: [
      {
        condition: '',
        choices: [], // Available choices
        outcomes: {}, // Mapping of choices to next scenes
        feedback: {} // Feedback for each choice
      }
    ]
  },
  mystery: {
    boxes: [
      {
        item: '',
        clues: [], // Available clues
        valid_questions: [], // Acceptable yes/no questions
        hints: [] // Progressive hints
      }
    ]
  }
};

ActivityContent.associate = (models) => {
  ActivityContent.belongsTo(models.Activity);
};

module.exports = ActivityContent;
