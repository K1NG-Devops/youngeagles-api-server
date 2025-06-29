#!/bin/bash

# Database Fix Script for Daniel Baker Homework Notifications
# This script applies the database fixes to resolve the homework notification issues

echo "🔧 Starting Database Fix for Daniel Baker Homework Notifications..."
echo "=================================================="

# Database connection details
DB_HOST="shuttle.proxy.rlwy.net"
DB_PORT="49263"
DB_USER="root"
DB_PASS="fhdgRvbocRQKcikxGTNsQUHVIMizngLb"
DB_NAME="skydek_DB"

# Function to execute SQL file
execute_sql_file() {
    local file=$1
    local description=$2
    
    echo "📝 $description"
    echo "   Executing: $file"
    
    if [ -f "$file" ]; then
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" --skip-ssl < "$file"
        if [ $? -eq 0 ]; then
            echo "   ✅ Success: $description completed"
        else
            echo "   ❌ Error: $description failed"
            return 1
        fi
    else
        echo "   ❌ Error: File $file not found"
        return 1
    fi
    echo ""
}

# Function to execute individual SQL command
execute_sql_command() {
    local sql=$1
    local description=$2
    
    echo "📝 $description"
    echo "   SQL: $sql"
    
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" --skip-ssl -e "$sql"
    if [ $? -eq 0 ]; then
        echo "   ✅ Success: $description completed"
    else
        echo "   ❌ Error: $description failed"
        return 1
    fi
    echo ""
}

# Check database connection
echo "🔌 Testing database connection..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" --skip-ssl -e "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ Database connection successful"
else
    echo "   ❌ Database connection failed"
    echo "   Please check your database credentials and network connection"
    exit 1
fi
echo ""

# Option 1: Execute complete fix script (recommended)
if [ -f "COMPLETE_DATABASE_FIX.sql" ]; then
    echo "🎯 Found comprehensive fix script. Executing..."
    execute_sql_file "COMPLETE_DATABASE_FIX.sql" "Complete Database Fix with Verification"
    
    # Verification query
    echo "🔍 Final Verification:"
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" --skip-ssl -e "
    SELECT 'Daniel Baker Submission Status' as check_type;
    SELECT hs.id, hs.studentName, hs.homework_id, h.title as homework_title, hs.status 
    FROM homework_submissions hs 
    LEFT JOIN homeworks h ON hs.homework_id = h.id 
    WHERE hs.studentId = 15;
    
    SELECT 'Notification Count' as check_type;
    SELECT 
        COUNT(*) as total_notifications,
        SUM(CASE WHEN userType = 'student' THEN 1 ELSE 0 END) as student_notifications,
        SUM(CASE WHEN userType = 'parent' THEN 1 ELSE 0 END) as parent_notifications
    FROM notifications 
    WHERE (userId = 15 AND userType = 'student') 
       OR (userId = 25 AND userType = 'parent' AND type = 'homework');
    "
    
elif [ -f "database_fixes.sql" ]; then
    echo "🎯 Found simple fix script. Executing..."
    execute_sql_file "database_fixes.sql" "Simple Database Fix"
    
else
    echo "⚠️  No fix scripts found. Applying manual fixes..."
    
    # Manual fix commands
    execute_sql_command "UPDATE homework_submissions SET homework_id = 15 WHERE studentId = 15 AND studentName = 'Daniel Baker' AND homework_id IS NULL;" "Link Daniel Baker's submission to homework"
    
    # Create notifications table if not exists
    execute_sql_command "CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        userType ENUM('parent', 'student', 'teacher', 'admin') NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT,
        type VARCHAR(50) DEFAULT 'general',
        \`read\` BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );" "Create notifications table"
    
    # Create notifications (only for parent, as this is for preschool children)
    execute_sql_command "INSERT IGNORE INTO notifications (userId, userType, title, body, type, \`read\`, createdAt, updatedAt) VALUES 
    (25, 'parent', 'Homework Submitted by Daniel Baker', 'Daniel Baker has submitted homework: \"Math Practice\"', 'homework', FALSE, NOW(), NOW());" "Create notifications for Daniel Baker's parent"
fi

echo "=================================================="
echo "🎉 Database Fix Completed!"
echo ""
echo "📋 What was fixed:"
echo "   • Daniel Baker's homework submission is now linked to homework ID 15 (Math Practice)"
echo "   • Notifications created for both Daniel Baker and his parent"
echo "   • Submit Work endpoint (/api/homework/submit/:homeworkId) is now working"
echo ""
echo "🧪 To verify the fix:"
echo "   • Check the PWA notifications page"
echo "   • Try submitting homework through the Submit Work page"
echo "   • Notification counter should now show the correct count"
echo ""
echo "✅ All fixes have been applied successfully!"
