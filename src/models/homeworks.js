export default (sequelize, DataTypes) => {
    const Homework = sequelize.define("Homework", {
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        due_date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        file_url: {
            type: DataTypes.TEXT,
            allowNull: true, // Allow null for activities without file attachments
        },
        instructions: {
            type: DataTypes.TEXT,
            allowNull: true, // Activity instructions
        },
        status: {
            type: DataTypes.ENUM("Pending", "Completed"),
            defaultValue: "Pending",
        },
        uploaded_by_teacher_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        class_name: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        grade: {
            type: DataTypes.STRING(20),
            allowNull: false,
        },
        type: {
            type: DataTypes.STRING(30),
            allowNull: true, // Interactive type: match, memory, quiz, etc.
        },
        items: {
            type: DataTypes.JSON,
            allowNull: true, // Stores interactive activity content
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: 'homeworks',
        timestamps: false,
    });

    return Homework;
};
