# Young Eagles API

A Node.js Express API server for the Young Eagles platform providing authentication, homework management, attendance tracking, event management, and public forms functionality.

## Features

- **Authentication System** - JWT-based auth for teachers, parents, and administrators
- **Homework Management** - Upload, assign, and track homework submissions
- **Attendance Tracking** - Record and manage student attendance
- **Event Management** - Create and manage school events
- **Public Forms** - Contact form, newsletter signup, and donation forms
- **Push Notifications** - Firebase Cloud Messaging integration
- **File Uploads** - Support for homework submissions and profile pictures
- **Database Integration** - MySQL with multiple database support

## Tech Stack

- **Node.js** with Express.js
- **MySQL** databases (Railway and local)
- **Firebase Admin SDK** for push notifications
- **JWT** for authentication
- **Multer** for file uploads
- **Nodemailer** for email notifications
- **ES6 Modules** support

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

### Homework
- `GET /api/homework` - Get homework assignments
- `POST /api/homework` - Create homework assignment
- `POST /api/homeworks/:id/complete` - Mark homework as complete
- `POST /api/submissions` - Submit homework

### Attendance
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance` - Record attendance

### Events
- `GET /api/events` - Get events
- `POST /api/events` - Create event

### Public Forms
- `POST /api/public/contact` - Contact form submission
- `POST /api/public/newsletter` - Newsletter signup
- `POST /api/public/donation` - Donation form submission

### Health Check
- `GET /health` - API health status
- `GET /api/health` - Detailed API health check

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name

# JWT Secret
JWT_SECRET=your_jwt_secret

# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Firebase Configuration
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PROJECT_ID=your_firebase_project_id

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd YoungEagles_API
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run database migrations:
```bash
npm run migrate
```

5. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## Database Setup

The API supports multiple MySQL databases:
- **Railway DB** - For teachers and admin users
- **SkyDek DB** - For parents and children

Run the included migration scripts to set up required tables:
```bash
node run_migration.js
```

## Deployment

This API can be deployed to various platforms:

### Railway
- Connect your GitHub repository
- Set environment variables
- Deploy automatically on push

### Render
- Connect repository
- Configure build and start commands
- Set environment variables

### VPS/Dedicated Server
- Use PM2 for process management
- Configure reverse proxy (Nginx)
- Set up SSL certificates

## Project Structure

```
src/
├── controllers/     # Request handlers
├── middleware/      # Auth and upload middleware
├── models/         # Database models
├── routes/         # API route definitions
├── utils/          # Utility functions
├── config/         # Configuration files
└── migrations/     # Database migration scripts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

Private - Young Eagles Platform

