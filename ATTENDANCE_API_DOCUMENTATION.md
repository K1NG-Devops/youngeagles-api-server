# Attendance API Documentation

## Overview
The Attendance API allows teachers to manage attendance for their assigned classes. Each teacher can only access and modify attendance records for students in their own class.

## Authentication
All endpoints require JWT authentication via the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

Only users with `userType: 'teacher'` can access these endpoints.

## Base URL
```
/api/attendance
```

## Endpoints

### 1. Get Class Attendance for a Date
**GET** `/api/attendance/class/:date?`

Get attendance status for all students in the teacher's class for a specific date.

#### Parameters
- `date` (optional): Date in YYYY-MM-DD format. Defaults to today if not provided.

#### Example Request
```bash
GET /api/attendance/class/2025-01-15
Authorization: Bearer your_jwt_token
```

#### Example Response
```json
{
  "success": true,
  "date": "2025-01-15",
  "className": "Grade 5A",
  "students": [
    {
      "id": 1,
      "name": "John Doe",
      "grade": "5",
      "age": 10,
      "className": "Grade 5A",
      "attendance_status": "present",
      "marked_at": "2025-01-15T09:30:00Z",
      "notes": null
    },
    {
      "id": 2,
      "name": "Jane Smith",
      "grade": "5",
      "age": 11,
      "className": "Grade 5A",
      "attendance_status": "unmarked",
      "marked_at": null,
      "notes": null
    }
  ],
  "totalStudents": 2,
  "attendanceStats": {
    "present": 1,
    "absent": 0,
    "late": 0,
    "unmarked": 1
  }
}
```

### 2. Mark Individual Attendance
**POST** `/api/attendance/mark`

Mark attendance for a single student.

#### Request Body
```json
{
  "childId": 1,
  "date": "2025-01-15",
  "status": "present",
  "notes": "Optional notes about attendance"
}
```

#### Parameters
- `childId` (required): ID of the student
- `date` (required): Date in YYYY-MM-DD format
- `status` (required): One of "present", "absent", "late"
- `notes` (optional): Additional notes about the attendance

#### Example Request
```bash
POST /api/attendance/mark
Authorization: Bearer your_jwt_token
Content-Type: application/json

{
  "childId": 1,
  "date": "2025-01-15",
  "status": "present",
  "notes": "Arrived on time"
}
```

#### Example Response
```json
{
  "success": true,
  "message": "Attendance marked as present for John Doe",
  "data": {
    "childId": 1,
    "childName": "John Doe",
    "date": "2025-01-15",
    "status": "present",
    "notes": "Arrived on time"
  }
}
```

### 3. Bulk Mark Attendance
**POST** `/api/attendance/bulk-mark`

Mark attendance for multiple students at once.

#### Request Body
```json
{
  "date": "2025-01-15",
  "attendanceRecords": [
    {
      "childId": 1,
      "status": "present",
      "notes": "On time"
    },
    {
      "childId": 2,
      "status": "late",
      "notes": "Arrived 10 minutes late"
    },
    {
      "childId": 3,
      "status": "absent"
    }
  ]
}
```

#### Example Response
```json
{
  "success": true,
  "message": "Bulk attendance processed: 3 successful, 0 errors",
  "results": [
    {
      "childId": 1,
      "childName": "John Doe",
      "status": "present",
      "success": true
    },
    {
      "childId": 2,
      "childName": "Jane Smith",
      "status": "late",
      "success": true
    },
    {
      "childId": 3,
      "childName": "Bob Johnson",
      "status": "absent",
      "success": true
    }
  ],
  "errors": [],
  "summary": {
    "total": 3,
    "successful": 3,
    "failed": 0
  }
}
```

### 4. Get Attendance History
**GET** `/api/attendance/history/:startDate/:endDate`

Get attendance history for the teacher's class within a date range.

#### Parameters
- `startDate` (required): Start date in YYYY-MM-DD format
- `endDate` (required): End date in YYYY-MM-DD format

#### Example Request
```bash
GET /api/attendance/history/2025-01-01/2025-01-31
Authorization: Bearer your_jwt_token
```

#### Example Response
```json
{
  "success": true,
  "className": "Grade 5A",
  "startDate": "2025-01-01",
  "endDate": "2025-01-31",
  "attendance": [
    {
      "date": "2025-01-15",
      "status": "present",
      "notes": null,
      "marked_at": "2025-01-15T09:30:00Z",
      "child_id": 1,
      "child_name": "John Doe",
      "grade": "5"
    }
  ],
  "totalRecords": 1
}
```

### 5. Get Attendance Statistics
**GET** `/api/attendance/stats/:month?`

Get attendance statistics for the teacher's class for a specific month.

#### Parameters
- `month` (optional): Month in YYYY-MM format. Defaults to current month if not provided.

#### Example Request
```bash
GET /api/attendance/stats/2025-01
Authorization: Bearer your_jwt_token
```

#### Example Response
```json
{
  "success": true,
  "className": "Grade 5A",
  "month": "2025-01",
  "studentStats": [
    {
      "child_id": 1,
      "child_name": "John Doe",
      "days_present": 18,
      "days_absent": 2,
      "days_late": 1,
      "total_marked_days": 21,
      "attendance_percentage": 85.71
    }
  ],
  "classStats": {
    "totalStudents": 1,
    "averageAttendanceRate": 85.71,
    "totalPresent": 18,
    "totalAbsent": 2,
    "totalLate": 1,
    "totalMarkedDays": 21
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Missing required fields: childId, date, status"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Access denied - teachers only"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "No class assigned to teacher"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to mark attendance"
}
```

## Frontend Integration Examples

### React/JavaScript Example

```javascript
// Get today's attendance
async function getTodayAttendance() {
  try {
    const response = await fetch('/api/attendance/class', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('Students:', data.students);
      console.log('Stats:', data.attendanceStats);
    }
  } catch (error) {
    console.error('Error fetching attendance:', error);
  }
}

// Mark single attendance
async function markAttendance(childId, status, notes = '') {
  try {
    const response = await fetch('/api/attendance/mark', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        childId,
        date: new Date().toISOString().split('T')[0],
        status,
        notes
      })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('Attendance marked:', data.message);
    }
  } catch (error) {
    console.error('Error marking attendance:', error);
  }
}

// Bulk mark attendance
async function bulkMarkAttendance(attendanceRecords) {
  try {
    const response = await fetch('/api/attendance/bulk-mark', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        attendanceRecords
      })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('Bulk attendance processed:', data.summary);
    }
  } catch (error) {
    console.error('Error bulk marking attendance:', error);
  }
}
```

## Database Schema

The attendance system uses the following database table:

```sql
CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  child_id INT NOT NULL,
  teacher_id INT NOT NULL,
  date DATE NOT NULL,
  status ENUM('present', 'absent', 'late') NOT NULL,
  notes TEXT,
  marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_child_id (child_id),
  INDEX idx_teacher_id (teacher_id),
  INDEX idx_date (date),
  INDEX idx_status (status),
  INDEX idx_child_date (child_id, date),
  UNIQUE KEY unique_attendance (child_id, date)
);
```

## Security Features

1. **Teacher Isolation**: Teachers can only access students in their assigned class
2. **Authentication Required**: All endpoints require valid JWT tokens
3. **Role-Based Access**: Only users with `userType: 'teacher'` can access these endpoints
4. **Input Validation**: All inputs are validated before processing
5. **SQL Injection Protection**: Parameterized queries prevent SQL injection attacks

## Testing

Run the setup script to create the attendance table:
```bash
node setup.js
```

Start the server:
```bash
npm run dev
```

Test endpoints using the provided examples or integrate with your frontend application.
