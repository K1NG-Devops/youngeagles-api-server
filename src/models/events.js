import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Other',
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending', // 'pending', 'approved', 'rejected'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  audience: {
    type: DataTypes.STRING,
    allowNull: true, // e.g., 'All', 'Parents', 'Teachers', 'Students'
  },
  attachments: {
    type: DataTypes.JSON,
    allowNull: true, // Array of file info objects
  },
}, {
  timestamps: true,
  tableName: 'events',
});

export default Event; 