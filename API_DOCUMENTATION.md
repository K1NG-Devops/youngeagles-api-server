# Young Eagles API Documentation

## Base URL
```
Development: http://localhost:3001
Production: https://your-production-url.com
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Authentication Endpoints

### Parent Login
**POST** `/api/auth/parent-login`

**Request Body:**
```json
{
  "username": "parent@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "parent@example.com",
    "name": "John Doe",
    "userType": "parent"
  }
}
```

### Teacher Login
**POST** `/api/auth/teacher-login`

**Request Body:**
```json
{
  "username": "teacher@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "teacher@example.com",
    "name": "Jane Smith",
    "userType": "teacher"
  }
}
```

### Admin Login
**POST** `/api/auth/admin-login`

**Request Body:**
```json
{
  "username": "admin@youngeagles.org.za",
  "password": "#Admin@2012"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@youngeagles.org.za",
    "name": "Admin User",
    "userType": "admin"
  }
}
```

---

## Children Management

### Get All Children
**GET** `/api/children`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "children": [
    {
      "id": 1,
      "name": "Alice Johnson",
      "className": "Pandas",
      "grade": "Grade 1",
      "age": 6,
      "parent_id": 1,
      "parent_name": "John Johnson",
      "parent_email": "john@example.com"
    }
  ]
}
```

### Get Children by Parent
**GET** `/api/children/parent/{parentId}`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "children": [
    {
      "id": 1,
      "name": "Alice Johnson",
      "className": "Pandas",
      "grade": "Grade 1",
      "age": 6,
      "parent_id": 1
    }
  ]
}
```

### Get Child by ID
**GET** `/api/children/{childId}`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "child": {
    "id": 1,
    "name": "Alice Johnson",
    "className": "Pandas",
    "grade": "Grade 1",
    "age": 6,
    "parent_id": 1,
    "parent_name": "John Johnson",
    "parent_email": "john@example.com"
  }
}
```

---

## Class Management

### Get All Classes
**GET** `/api/classes`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "classes": [
    {
      "id": "Pandas",
      "name": "Pandas",
      "student_count": 15
    },
    {
      "id": "Lions",
      "name": "Lions",
      "student_count": 12
    }
  ]
}
```

### Get Children by Class
**GET** `/api/classes/{classId}/children`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "children": [
    {
      "id": 1,
      "name": "Alice Johnson",
      "className": "Pandas",
      "grade": "Grade 1",
      "age": 6,
      "parent_id": 1,
      "parent_name": "John Johnson",
      "parent_email": "john@example.com"
    }
  ]
}
```

### Get Class by ID
**GET** `/api/classes/{classId}`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "class": {
    "id": "Pandas",
    "name": "Pandas",
    "student_count": 15
  }
}
```

---

## Homework Management

### Create Homework
**POST** `/api/homework`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Math Assignment",
  "description": "Complete exercises 1-10 from the workbook",
  "due_date": "2024-01-15",
  "classId": "Pandas"
}
```

**Response:**
```json
{
  "success": true,
  "id": "123",
  "message": "Homework created successfully"
}
```

### Get Homework by Teacher
**GET** `/api/homework/teacher/{teacherId}`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "homework": [
    {
      "id": 1,
      "title": "Math Assignment",
      "description": "Complete exercises 1-10",
      "due_date": "2024-01-15T00:00:00.000Z",
      "classId": "Pandas",
      "status": "pending",
      "created_at": "2024-01-01T10:00:00.000Z",
      "file_url": null,
      "submission_count": 5
    }
  ]
}
```

### Get Homework by Class
**GET** `/api/homework/class/{classId}`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "homework": [
    {
      "id": 1,
      "title": "Math Assignment",
      "description": "Complete exercises 1-10",
      "due_date": "2024-01-15T00:00:00.000Z",
      "classId": "Pandas",
      "status": "pending",
      "created_at": "2024-01-01T10:00:00.000Z",
      "file_url": null,
      "teacher_name": "Jane Smith"
    }
  ]
}
```

### Get Homework for Child
**GET** `/api/homework/child/{childId}`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "homework": [
    {
      "id": 1,
      "title": "Math Assignment",
      "description": "Complete exercises 1-10",
      "due_date": "2024-01-15T00:00:00.000Z",
      "classId": "Pandas",
      "status": "pending",
      "created_at": "2024-01-01T10:00:00.000Z",
      "file_url": null,
      "teacher_name": "Jane Smith",
      "submission_id": 101,
      "submitted_at": "2024-01-10T14:30:00.000Z",
      "grade": 85.5,
      "feedback": "Great work!",
      "submission_file_url": "/uploads/homework/file.pdf"
    }
  ]
}
```

### Get Single Homework
**GET** `/api/homework/{homeworkId}`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "homework": {
    "id": 1,
    "title": "Math Assignment",
    "description": "Complete exercises 1-10",
    "due_date": "2024-01-15T00:00:00.000Z",
    "classId": "Pandas",
    "status": "pending",
    "created_at": "2024-01-01T10:00:00.000Z",
    "file_url": null,
    "teacher_name": "Jane Smith"
  }
}
```

### Submit Homework
**POST** `/api/homework/{homeworkId}/submit`

**Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`

**Request Body (Form Data):**
- `child_id`: string (required)
- `files`: file upload(s) (required for traditional homework)
- `comments`: string (optional)
- `interactive_score`: number (required for interactive homework)
- `time_spent`: number (optional, time in minutes)
- `answers`: string/JSON (optional, for interactive homework)

**Response for Traditional Homework:**
```json
{
  "success": true,
  "message": "Traditional homework submitted successfully",
  "submission": {
    "id": 456,
    "homework_id": 123,
    "child_id": 1,
    "submitted_at": "2024-01-15T10:30:00.000Z",
    "status": "submitted",
    "submission_type": "file_upload",
    "file_url": "/uploads/homework_submissions/file.pdf",
    "child_name": "Alice Johnson"
  },
  "notification": {
    "sent": true,
    "teacher_name": "Jane Smith",
    "score": null
  }
}
```

**Response for Interactive Homework:**
```json
{
  "success": true,
  "message": "Interactive homework submitted successfully with 85% score",
  "submission": {
    "id": 456,
    "homework_id": 123,
    "child_id": 1,
    "submitted_at": "2024-01-15T10:30:00.000Z",
    "status": "graded",
    "submission_type": "interactive",
    "score": 85,
    "grade": 85,
    "time_spent": 25,
    "auto_graded": true,
    "child_name": "Alice Johnson"
  },
  "notification": {
    "sent": true,
    "teacher_name": "Jane Smith",
    "score": 85
  }
}
```

### Grade Homework Submission
**POST** `/api/homework/{homeworkId}/submissions/{submissionId}/grade`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "grade": 85.5,
  "feedback": "Excellent work! Keep it up.",
  "return_to_parent": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Homework graded successfully and returned to parent",
  "grading": {
    "submission_id": 456,
    "homework_id": 123,
    "grade": 85.5,
    "feedback": "Excellent work! Keep it up.",
    "status": "returned",
    "graded_at": "2024-01-15T15:30:00.000Z",
    "student_name": "Alice Johnson",
    "homework_title": "Math Assignment"
  }
}
```

### AI Grading (Teachers)
**POST** `/api/ai/grading/start`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "submissions": [
    {"id": 456, "homework_id": 123},
    {"id": 457, "homework_id": 123}
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "queueId": "grading_1640995200000_17",
    "status": "started",
    "estimatedTime": "2-5 minutes",
    "submissionCount": 2
  },
  "message": "AI grading started successfully"
}
```

---

## File Handling

### Upload Homework Attachment
**POST** `/api/homework/upload`

**Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`

**Request Body (Form Data):**
- `file`: file upload (required)

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "fileId": "homework-1640995200000-123456789.pdf",
  "filePath": "/uploads/homework/homework-1640995200000-123456789.pdf"
}
```

### Download Homework File
**GET** `/api/homework/files/{fileId}`

**Response:** File download (binary data)

---

## Notifications

### Get All Notifications
**GET** `/api/notifications`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "notifications": [
    {
      "id": 1,
      "title": "Interactive Homework Completed",
      "message": "Interactive homework 'Math Quiz' completed by Alice Johnson with 85% score. Submitted to Jane Smith.",
      "type": "homework_submission",
      "priority": "medium",
      "read": false,
      "sender": "Jane Smith",
      "score": 85,
      "homework_id": 123,
      "submission_id": 456,
      "auto_graded": true,
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Get Notification by ID
**GET** `/api/notifications/{id}`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "notification": {
    "id": 1,
    "title": "Homework Graded and Returned",
    "message": "Homework 'Math Assignment' for Alice Johnson has been graded by Jane Smith. Grade: 85.5%. Excellent work!",
    "type": "homework_graded",
    "priority": "high",
    "read": false,
    "sender": "Jane Smith",
    "score": 85.5,
    "homework_id": 123,
    "submission_id": 456,
    "auto_graded": false,
    "timestamp": "2024-01-15T15:30:00.000Z"
  }
}
```

### Mark Notification as Read
**POST** `/api/notifications/{id}/read`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Notification 1 marked as read"
}
```

### Mark All Notifications as Read
**POST** `/api/notifications/mark-all-read`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

### Get Unread Notifications Count
**GET** `/api/notifications/unread/count`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "count": 3
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common HTTP Status Codes

- `200` - Success
- `400` - Bad Request (missing required fields)
- `401` - Unauthorized (invalid or missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

---

## Database Schema

### Required Tables

#### homework_submissions
If this table doesn't exist, run the migration:

```sql
CREATE TABLE IF NOT EXISTS homework_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  homework_id INT NOT NULL,
  child_id INT NOT NULL,
  submitted_at DATETIME NOT NULL,
  file_url VARCHAR(500),
  grade DECIMAL(5,2),
  feedback TEXT,
  graded_at DATETIME,
  status ENUM('submitted', 'graded', 'returned') DEFAULT 'submitted',
  created_at TIMESTAMP DEFAULT CURRENT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_homework_id (homework_id),
  INDEX idx_child_id (child_id),
  INDEX idx_status (status),
  INDEX idx_submitted_at (submitted_at),
  UNIQUE KEY unique_submission (homework_id, child_id)
);
```

**Note:** Teachers are stored in the `staff` table with `role = 'teacher'`, not in a separate `teachers` table.

---

## Testing

Run the API test suite:

```bash
# Start the server first
npm run dev

# In another terminal, run tests
npm test
```

The test script will validate all endpoints and provide a success rate report.

---

## Environment Variables

Required environment variables:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database

# JWT Secret
JWT_SECRET=your-secret-key

# Server Configuration
PORT=3001
NODE_ENV=development
``` 