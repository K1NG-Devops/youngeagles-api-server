# 📁 YoungEagles API - Project Structure

## 🏗️ **Organized Project Layout**

This project has been organized with a clean structure separating core API code from documentation, testing, and development artifacts.

## 📂 **Directory Structure**

```
YoungEagles_API/
├── src/                          # Core API source code
│   ├── routes/                  # API route handlers
│   ├── controllers/             # Business logic controllers
│   ├── services/                # Business services
│   ├── models/                  # Data models
│   ├── middleware/              # Express middleware
│   ├── migrations/              # Database migrations
│   ├── utils/                   # Utility functions
│   ├── config/                  # Configuration files
│   ├── db.js                    # Database connection
│   └── index.js                 # Main application entry
├── uploads/                     # File uploads (homework submissions)
├── docs/                        # Documentation and development files
│   ├── documentation/           # All markdown documentation
│   ├── testing/                 # Test scripts and verification
│   ├── setup-scripts/           # Setup and utility scripts
│   ├── migration/               # Database migration scripts
│   ├── sql/                     # SQL schema files
│   └── reports/                 # Logs and database files
├── package.json                 # Dependencies and scripts
├── eslint.config.js            # Linting configuration
└── .gitignore                  # Git ignore rules (includes docs/)
```

## 📋 **Documentation Categories**

### **docs/documentation/**
- API documentation and endpoints
- Implementation guides
- Feature specifications
- Attendance system docs
- Push notification setup
- Deployment guides

### **docs/testing/**
- API endpoint tests
- Database verification scripts
- Authentication tests
- Homework system tests
- Interactive homework tests
- Data validation scripts

### **docs/setup-scripts/**
- Database setup scripts
- User creation scripts
- Payment table creation
- Admin utilities

### **docs/migration/**
- Database migration scripts
- Data cleanup utilities
- Schema update scripts
- Homework table migrations

### **docs/sql/**
- Table creation SQL files
- Schema definitions
- Index creation scripts

### **docs/reports/**
- Server logs
- Database files
- Error reports
- Development artifacts

## 🚫 **What's Excluded from Git**

The `docs/` folder is added to `.gitignore` to keep the repository clean:
- Documentation files
- Test scripts
- Setup utilities
- Migration scripts
- Log files
- Database dumps

## 🎯 **Core API Features**

### **Authentication & Users**
- JWT-based authentication
- Parent, teacher, admin roles
- Secure password handling
- User management

### **Education Management**
- Homework assignments
- Interactive homework
- Grading system
- Class management
- Student progress tracking

### **Communication**
- Push notifications (VAPID)
- Email notifications
- Announcement system
- Parent-teacher messaging

### **Data Management**
- MySQL database
- File upload handling
- Attendance tracking
- Payment processing

## 🔧 **Key Services**

### **Push Notifications**
- `pushNotificationService.js` - Background push notifications
- VAPID key management
- Cross-platform notification delivery
- Homework and grading alerts

### **Security**
- JWT token management
- Role-based access control
- Input validation
- SQL injection prevention

### **Database**
- Connection pooling
- Migration system
- Backup utilities
- Performance optimization

## 🚀 **Production Ready**

✅ Clean project structure  
✅ Comprehensive API documentation  
✅ Push notification system  
✅ Secure authentication  
✅ Database migration system  
✅ File upload handling  
✅ Error logging  
✅ Performance optimized  

## 📡 **API Endpoints**

### **Core Routes**
- `/api/auth/*` - Authentication
- `/api/homework/*` - Homework management
- `/api/notifications/*` - Notification system
- `/api/push/*` - Push notifications
- `/api/children/*` - Student management
- `/api/classes/*` - Class management
- `/api/teacher/*` - Teacher dashboard
- `/api/parent/*` - Parent portal

---

**Last Updated**: January 2025 - Project restructuring and push notifications complete 