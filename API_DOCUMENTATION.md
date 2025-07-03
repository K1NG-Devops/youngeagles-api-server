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
- `childId`: string (required)
- `file`: file upload (optional)

**Response:**
```json
{
  "success": true,
  "message": "Homework submitted successfully",
  "submissionId": "456"
}
```

### Grade Homework (AI Assistant)
**POST** `/api/homework/{homeworkId}/student/{studentId}/grade`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "score": 85.5,
  "feedback": "Excellent work! Keep it up."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Homework graded successfully",
  "graded": true
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