# Young Eagles API Server - Production

## 🚀 Production-Ready API Server

This is the production version of the Young Eagles API server, optimized for deployment with all necessary endpoints for the PWA.

## ✅ Features

- **Admin Dashboard** - Complete admin functionality
- **Authentication** - Secure login for admins and teachers  
- **File Upload** - 50MB limit with multiple file types
- **Real-time Features** - WebSocket support
- **Database Integration** - Railway MySQL connection
- **CORS Support** - Multi-origin support for PWA
- **Security** - PBKDF2 password hashing, JWT tokens

## 📋 Available Endpoints

### Health & Info
- `GET /api/health` - Server health check
- `GET /api` - API information

### Authentication
- `POST /api/auth/admin-login` - Admin login
- `POST /api/auth/teacher-login` - Teacher login

### Admin Endpoints
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/analytics` - Analytics data
- `GET /api/admin/quick-actions` - Quick action items
- `GET /api/admin/users` - User management

### File Upload
- `POST /api/homework/submit` - Submit homework with files

## 🔧 Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   - Copy `.env.example` to `.env`
   - Update database credentials
   - Set JWT secret

3. **Start Server**
   ```bash
   npm start
   ```

## 🌐 Deployment

### Railway Deployment
1. Connect repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

### Environment Variables Required
- `NODE_ENV=production`
- `PORT=3001`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`

## 🔐 Default Admin Credentials

```
Email: admin@youngeagles.org.za
Password: YoungEagles2024!
```

## 📊 Database Schema

The server expects these tables:
- `staff` - Admin and teacher accounts
- `users` - Parent accounts  
- `children` - Student records
- `homework` - Homework assignments
- `submissions` - Homework submissions
- `submission_files` - Uploaded files

## 🛡️ Security Features

- **Password Hashing** - PBKDF2 with salt
- **JWT Tokens** - 24-hour expiration
- **CORS Protection** - Whitelist origins only
- **File Validation** - Type and size limits
- **SQL Injection Protection** - Parameterized queries

## 🔄 Production Optimizations

- **No Console Logs** - Clean production output
- **Error Handling** - Graceful error responses
- **Connection Pooling** - Efficient database connections
- **File Upload Limits** - 50MB maximum
- **Memory Management** - Optimized for production

## 📱 PWA Integration

This API is specifically designed to work with the Young Eagles PWA:
- **CORS configured** for Vercel deployment
- **WebSocket support** for real-time features
- **File upload** optimized for mobile devices
- **Offline-ready** error responses

