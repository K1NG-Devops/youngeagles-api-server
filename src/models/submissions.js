export default (sequelize, DataTypes) => {
  const Submission = sequelize.define("Submission", {
    homework_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    file_url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    submitted_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'submissions',
    timestamps: false,
  });

  return Submission;
};
