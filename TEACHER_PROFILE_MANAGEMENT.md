# Teacher Profile Management System

## Overview
The Young Eagles API now includes a comprehensive teacher profile management system that allows teachers to view and update their professional information.

## New Teachers Added

### 1. Dimakatso Mogashoa
- **Email**: dimakatso.mogashoa@youngeagles.org.za
- **Password**: #Katso@yehc103
- **Class**: Panad Class
- **Qualification**: Bachelor of Education
- **Specialization**: Early Childhood Development

### 2. Seipati Kgalema
- **Email**: seipati.kgalema@youngeagles.org.za
- **Password**: #Seipati@yehc102
- **Class**: Curious Cubs
- **Qualification**: Bachelor of Education
- **Specialization**: Primary Education

## Database Schema Updates

### Staff Table Enhancement
The `staff` table now includes the following additional columns:
- `className` VARCHAR(50) - Teacher's assigned class
- `qualification` VARCHAR(255) - Academic qualifications
- `specialization` VARCHAR(255) - Area of specialization
- `bio` TEXT - Professional biography
- `phone` VARCHAR(20) - Contact phone number
- `experience_years` INT - Years of teaching experience
- `emergency_contact_name` VARCHAR(255) - Emergency contact person
- `emergency_contact_phone` VARCHAR(20) - Emergency contact phone
- `profile_picture` TEXT - URL to profile picture
- `updated_at` TIMESTAMP - Last profile update timestamp

## API Endpoints

### 1. Get Teacher Profile
**GET** `/api/teacher/profile`

**Headers:**
```
Authorization: Bearer <teacher_token>
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": 16,
    "name": "Dimakatso Mogashoa",
    "email": "dimakatso.mogashoa@youngeagles.org.za",
    "role": "teacher",
    "className": "Panad Class",
    "qualification": "Bachelor of Education",
    "specialization": "Early Childhood Development",
    "bio": "Passionate educator...",
    "phone": "+27123456789",
    "experience_years": 5,
    "emergency_contact_name": "Emergency Contact",
    "emergency_contact_phone": "+27987654321",
    "profile_picture": null,
    "isVerified": true,
    "joinedAt": "2025-06-27T12:00:00.000Z",
    "updatedAt": "2025-06-27T12:30:00.000Z"
  },
  "teacher": {
    "id": 16,
    "name": "Dimakatso Mogashoa",
    "email": "dimakatso.mogashoa@youngeagles.org.za",
    "phone": "+27123456789",
    "isVerified": true,
    "joinedAt": "2025-06-27T12:00:00.000Z"
  },
  "stats": {
    "totalClasses": 3,
    "totalStudents": 25
  },
  "message": "Teacher profile fetched successfully"
}
```

### 2. Update Teacher Profile
**PUT** `/api/teacher/profile`

**Headers:**
```
Authorization: Bearer <teacher_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Dimakatso Mogashoa",
  "phone": "+27123456789",
  "qualification": "Bachelor of Education",
  "specialization": "Early Childhood Development",
  "bio": "Passionate educator with experience in early childhood development and creative learning.",
  "experience_years": 5,
  "emergency_contact_name": "Emergency Contact",
  "emergency_contact_phone": "+27987654321"
}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": 16,
    "name": "Dimakatso Mogashoa",
    "email": "dimakatso.mogashoa@youngeagles.org.za",
    "role": "teacher",
    "className": "Panad Class",
    "qualification": "Bachelor of Education",
    "specialization": "Early Childhood Development",
    "bio": "Passionate educator with experience in early childhood development and creative learning.",
    "phone": "+27123456789",
    "experience_years": 5,
    "emergency_contact_name": "Emergency Contact",
    "emergency_contact_phone": "+27987654321",
    "profile_picture": null,
    "created_at": "2025-06-27T12:00:00.000Z",
    "updated_at": "2025-06-27T12:30:00.000Z"
  },
  "message": "Profile updated successfully"
}
```

### 3. Change Teacher Password
**PUT** `/api/teacher/profile/password`

**Headers:**
```
Authorization: Bearer <teacher_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "currentPassword": "#Katso@yehc103",
  "newPassword": "#NewPassword@123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

## Authentication

### Teacher Login
**POST** `/api/auth/teacher/login`

**Request Body:**
```json
{
  "email": "dimakatso.mogashoa@youngeagles.org.za",
  "password": "#Katso@yehc103"
}
```

**Response:**
```json
{
  "message": "Teacher login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 16,
    "email": "dimakatso.mogashoa@youngeagles.org.za",
    "name": "Dimakatso Mogashoa",
    "role": "teacher"
  }
}
```

## Password Security

All teacher passwords are hashed using PBKDF2 with SHA-512 and must meet the following requirements:
- At least 8 characters long
- Contains uppercase letters
- Contains lowercase letters
- Contains numbers
- Contains special characters (!@#$%^&*(),.?":{}|<>)

## Features

### ✅ Implemented
- Teacher profile viewing with comprehensive information
- Teacher profile editing (name, phone, qualification, specialization, bio, experience, emergency contacts)
- Secure password change functionality
- Enhanced authentication system
- Database schema with additional professional fields
- Backward compatibility with existing API structure

### 🔄 Validation & Security
- Input validation for all profile fields
- Password strength validation
- Token-based authentication
- Role-based access control
- SQL injection protection

### 📱 Frontend Integration
The API provides both new enhanced profile data and maintains backward compatibility with existing frontend implementations through dual response structures.

## Testing

Run the test suite:
```bash
node testNewTeachers.js
```

Test results show:
- ✅ Teacher login functionality
- ✅ Profile data retrieval with enhanced fields
- ✅ Profile update functionality
- ✅ Password security validation

## Database Seeding

To add/update teachers:
```bash
node seedNewTeachers.js
```

This script:
- Checks and adds the `className` column if needed
- Creates/updates teacher accounts with proper password hashing
- Sets up professional information and class assignments

## Class Assignments

- **Dimakatso Mogashoa**: Panad Class (Early childhood focus)
- **Seipati Kgalema**: Curious Cubs (Primary education focus)

## Security Notes

- All passwords are hashed using PBKDF2 with salt
- Tokens have 24-hour expiration
- Role-based access ensures only teachers can access their own profiles
- Input validation prevents SQL injection and XSS attacks
- Password change requires current password verification

## Future Enhancements

Potential future features:
- Profile picture upload functionality
- Email verification for profile changes
- Activity logging for profile updates
- Integration with homework and student management systems
- Professional development tracking
- Performance metrics and analytics
