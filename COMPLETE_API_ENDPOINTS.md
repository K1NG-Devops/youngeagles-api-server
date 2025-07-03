# Young Eagles API - Complete Endpoints Documentation

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

## 🏥 Health Check Endpoints

### Server Health Check
**GET** `/health`
- **Description**: Check if the server is running
- **Authentication**: None required
- **Response**:
```json
{
  "status": "OK",
  "timestamp": "2025-07-02T15:36:09.211Z",
  "service": "Young Eagles API - Minimal",
  "version": "1.0.0"
}
```

### API Health Check
**GET** `/api/health`
- **Description**: Check API status
- **Authentication**: None required
- **Response**: Same as above

### Root Endpoint with Service Info
**GET** `/`
- **Description**: Get service information and available endpoints
- **Authentication**: None required
- **Response**:
```json
{
  "message": "Young Eagles API - Minimal Version",
  "version": "1.0.0",
  "status": "Running",
  "endpoints": {
    "health": "/health",
    "auth": "/api/auth",
    "children": "/api/children",
    "classes": "/api/classes",
    "homework": "/api/homework"
  }
}
```

---

## 🔐 Authentication Endpoints

### Parent Login
**POST** `/api/auth/parent-login`

**Request Body:**
```json
{
  "username": "parent@example.com",
  "password": "password123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 25,
    "email": "mbaker@roboworld.co.za",
    "name": "Martin Baker",
    "userType": "parent",
    "role": "parent"
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

**Response (Success):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "teacher@example.com",
    "name": "Jane Smith",
    "userType": "teacher",
    "role": "teacher"
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

**Response (Success):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@youngeagles.org.za",
    "name": "Admin User",
    "userType": "admin",
    "role": "admin"
  }
}
```

---

## 👶 Children Management

### Get All Children
**GET** `/api/children`
- **Authentication**: Required (admin/teacher only)
- **Headers**: `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "children": [
    {
      "id": 24,
      "name": "Shirley Baker",
      "className": "Curious Cubs",
      "grade": "Nursery",
      "age": 3,
      "parent_id": 25,
      "parent_name": "Martin Baker",
      "parent_email": "mbaker@roboworld.co.za"
    }
  ]
}
```

### Get Children by Parent
**GET** `/api/children/parent/{parentId}`
- **Authentication**: Required
- **Headers**: `Authorization: Bearer <token>`
- **Parameters**: 
  - `parentId` (path): ID of the parent

**Response:**
```json
{
  "success": true,
  "children": [
    {
      "id": 24,
      "name": "Shirley Baker",
      "className": "Curious Cubs",
      "grade": "Nursery",
      "age": 3,
      "parent_id": 25
    }
  ]
}
```

### Get Child by ID
**GET** `/api/children/{childId}`
- **Authentication**: Required
- **Headers**: `Authorization: Bearer <token>`
- **Parameters**: 
  - `childId` (path): ID of the child

**Response:**
```json
{
  "success": true,
  "child": {
    "id": 24,
    "name": "Shirley Baker",
    "className": "Curious Cubs",
    "grade": "Nursery",
    "age": 3,
    "parent_id": 25,
    "parent_name": "Martin Baker",
    "parent_email": "mbaker@roboworld.co.za"
  }
}
```

---

## 📚 Class Management

### Get All Classes
**GET** `/api/classes`
- **Authentication**: Required
- **Headers**: `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "classes": [
    {
      "id": "Curious Cubs",
      "name": "Curious Cubs",
      "student_count": 5
    },
    {
      "id": "Panda",
      "name": "Panda",
      "student_count": 3
    }
  ]
}
```

### Get Children by Class
**GET** `/api/classes/{classId}/children`
- **Authentication**: Required
- **Headers**: `Authorization: Bearer <token>`
- **Parameters**: 
  - `classId` (path): Name/ID of the class (e.g., "Curious Cubs")

**Response:**
```json
{
  "success": true,
  "children": [
    {
      "id": 24,
      "name": "Shirley Baker",
      "className": "Curious Cubs",
      "grade": "Nursery",
      "age": 3,
      "parent_id": 25,
      "parent_name": "Martin Baker",
      "parent_email": "mbaker@roboworld.co.za"
    }
  ]
}
```

### Get Class by ID
**GET** `/api/classes/{classId}`
- **Authentication**: Required
- **Headers**: `Authorization: Bearer <token>`
- **Parameters**: 
  - `classId` (path): Name/ID of the class

**Response:**
```json
{
  "success": true,
  "class": {
    "id": "Curious Cubs",
    "name": "Curious Cubs",
    "student_count": 5
  }
}
```

### Get Teacher's Classes
**GET** `/api/classes/teacher/{teacherId}`
- **Authentication**: Required (teacher or admin)
- **Headers**: `Authorization: Bearer <token>`
- **Parameters**: 
  - `teacherId` (path): ID of the teacher

**Response:**
```json
{
  "success": true,
  "classes": [
    {
      "id": 1,
      "name": "Curious Cubs",
      "teacher_name": "Jane Smith",
      "student_count": 5
    }
  ]
}
```

---

## 📋 Homework Management

### Get Homework for Parent's Children
**GET** `/api/homework/parent/{parentId}`
- **Authentication**: Required (parent or admin)
- **Headers**: `Authorization: Bearer <token>`
- **Parameters**: 
  - `parentId` (path): ID of the parent
  - `childId` (query, optional): Filter by specific child

**Example**: `/api/homework/parent/25?childId=24`

**Response:**
```json
{
  "success": true,
  "homework": [
    {
      "id": 58,
      "title": "Assignment for Shirley Baker",
      "due_date": null,
      "instructions": "Complete the assigned activities",
      "child_name": "Shirley",
      "child_last_name": "Baker",
      "class_name": "Curious Cubs",
      "teacher_name": "Jane Smith",
      "status": "pending",
      "submitted_at": null,
      "grade": null,
      "teacher_feedback": null
    }
  ],
  "children": [
    {
      "id": 24,
      "first_name": "Shirley",
      "last_name": "Baker",
      "class_name": "Curious Cubs"
    }
  ]
}
```

### Get Homework by Class
**GET** `/api/homework/class/{className}`
- **Authentication**: Required
- **Headers**: `Authorization: Bearer <token>`
- **Parameters**: 
  - `className` (path): Name of the class (e.g., "Curious Cubs")

**Response:**
```json
{
  "success": true,
  "homeworks": [
    {
      "id": 58,
      "title": "Assignment for Shirley Baker",
      "due_date": null,
      "file_url": null,
      "status": null,
      "uploaded_by_teacher_id": 17,
      "class_name": "Curious Cubs",
      "created_at": "2025-07-01T20:11:48.000Z",
      "type": null,
      "items": null,
      "grades": null,
      "instructions": "Complete the assigned activities",
      "grade": null,
      "teacher_name": "Jane Smith"
    }
  ]
}
```

### Get Single Homework Assignment
**GET** `/api/homework/{homeworkId}`
- **Authentication**: Required
- **Headers**: `Authorization: Bearer <token>`
- **Parameters**: 
  - `homeworkId` (path): ID of the homework

**Response:**
```json
{
  "success": true,
  "homework": {
    "id": 58,
    "title": "Assignment for Shirley Baker",
    "due_date": null,
    "file_url": null,
    "status": null,
    "uploaded_by_teacher_id": 17,
    "class_name": "Curious Cubs",
    "created_at": "2025-07-01T20:11:48.000Z",
    "instructions": "Complete the assigned activities",
    "teacher_name": "Jane Smith"
  }
}
```

### Create Homework
**POST** `/api/homework`
- **Authentication**: Required (teacher/admin)
- **Headers**: `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Math Assignment",
  "description": "Complete exercises 1-10 from the workbook",
  "due_date": "2024-01-15",
  "classId": "Curious Cubs"
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
- **Authentication**: Required (teacher/admin)
- **Headers**: `Authorization: Bearer <token>`
- **Parameters**: 
  - `teacherId` (path): ID of the teacher

**Response:**
```json
{
  "success": true,
  "homework": [
    {
      "id": 58,
      "title": "Assignment for Shirley Baker",
      "description": "Complete the assigned activities",
      "due_date": null,
      "classId": "Curious Cubs",
      "status": null,
      "created_at": "2025-07-01T20:11:48.000Z",
      "file_url": null,
      "submission_count": 0
    }
  ]
}
```

### Get Homework for Child
**GET** `/api/homework/child/{childId}`
- **Authentication**: Required
- **Headers**: `Authorization: Bearer <token>`
- **Parameters**: 
  - `childId` (path): ID of the child

**Response:**
```json
{
  "success": true,
  "homework": [
    {
      "id": 58,
      "title": "Assignment for Shirley Baker",
      "description": "Complete the assigned activities",
      "due_date": null,
      "classId": "Curious Cubs",
      "status": null,
      "created_at": "2025-07-01T20:11:48.000Z",
      "teacher_name": "Jane Smith",
      "submission_id": null,
      "submitted_at": null,
      "grade": null,
      "feedback": null,
      "submission_file_url": null
    }
  ]
}
```

### Submit Homework
**POST** `/api/homework/{homeworkId}/submit`
- **Authentication**: Required
- **Headers**: `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
- **Parameters**: 
  - `homeworkId` (path): ID of the homework

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

### Grade Homework
**POST** `/api/homework/{homeworkId}/student/{studentId}/grade`
- **Authentication**: Required (teacher/admin)
- **Headers**: `Authorization: Bearer <token>`
- **Parameters**: 
  - `homeworkId` (path): ID of the homework
  - `studentId` (path): ID of the student

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

## 📁 File Handling

### Upload Homework Attachment
**POST** `/api/homework/upload`
- **Authentication**: Required
- **Headers**: `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`

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
- **Authentication**: None required
- **Parameters**: 
  - `fileId` (path): ID of the file

**Response**: File download (binary data)

---

## 👪 Parent Specific Endpoints

### Get Parent's Children
**GET** `/api/parent/children`
- **Authentication**: Required (parent)
- **Headers**: `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "children": [
    {
      "id": 24,
      "name": "Shirley Baker",
      "className": "Curious Cubs",
      "grade": "Nursery",
      "age": 3
    }
  ]
}
```

### Get Specific Child Details (Parent View)
**GET** `/api/parent/children/{childId}`
- **Authentication**: Required (parent)
- **Headers**: `Authorization: Bearer <token>`
- **Parameters**: 
  - `childId` (path): ID of the child

**Response:**
```json
{
  "success": true,
  "child": {
    "id": 24,
    "name": "Shirley Baker",
    "className": "Curious Cubs",
    "grade": "Nursery",
    "age": 3
  }
}
```

---

## 🚨 Error Responses

All endpoints may return error responses in the following format:

### Error Response Format
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

### Example Error Responses

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Access denied"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Child not found"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## 🐛 Known Issues & Fixes

### Issue: Homework Not Showing for Shirley Baker

**Problem**: The homework route `/api/homework/parent/{parentId}` has SQL query errors that prevent it from returning homework data.

**Root Cause**: 
1. Query references wrong table (`homework` instead of `homeworks`)
2. Query references wrong column names (`hs.date` instead of `hs.submitted_at`)
3. Missing proper joins with existing database schema

**Current Status**: Homework exists in database but API query fails

**Affected Endpoint**: `GET /api/homework/parent/{parentId}`

**Workaround**: Use `GET /api/homework/class/{className}` to get homework by class name

---

## 🔧 Testing the API

### Quick Test Commands

```bash
# Test server health
curl http://localhost:3001/health

# Test login (replace with actual credentials)
curl -X POST http://localhost:3001/api/auth/parent-login \
  -H "Content-Type: application/json" \
  -d '{"username": "mbaker@roboworld.co.za", "password": "actual_password"}'

# Test getting children (replace with actual token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/children

# Test homework by class
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/homework/class/Curious%20Cubs
```

### Run Automated Tests
```bash
# Start server first
npm run dev

# Run test suite (in another terminal)
node test-api-endpoints.js
```

---

## 📊 Database Schema Overview

### Key Tables Used by API
- `users` - Parent accounts
- `staff` - Teacher and admin accounts  
- `children` - Child records
- `classes` - Class information
- `homeworks` - Homework assignments
- `homework_submissions` - Homework submissions

### Important Note
The API uses both `homework` and `homeworks` table references in different routes, which causes inconsistency. The actual table is `homeworks`.

---

## 🚀 Frontend Integration Tips

1. **Always include Authorization header** for protected endpoints
2. **Handle 401 responses** by redirecting to login
3. **Use proper Content-Type** for file uploads (`multipart/form-data`)
4. **Check `success` field** in responses before processing data
5. **Implement error handling** for all HTTP status codes
6. **URL encode class names** when using them in paths (e.g., "Curious Cubs" → "Curious%20Cubs")

---

## 📝 Notes for Development Team

1. **Shirley Baker's homework issue** needs SQL query fix in homework routes
2. **Table naming inconsistency** between `homework` and `homeworks` needs to be resolved
3. **Teacher information** is not properly joined in homework queries
4. **Status filtering** logic needs improvement for homework display
5. **File upload validation** should be enhanced for security

---

*Last Updated: July 2, 2025*
*API Version: 1.0.0*
