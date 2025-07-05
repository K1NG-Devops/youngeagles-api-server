# Young Eagles API - Minimal Version

A minimal version of the Young Eagles preschool management API with essential features.

## Features

- ✅ Basic Express server with security middleware
- ✅ MySQL database integration
- ✅ JWT-based authentication
- ✅ User login (Teacher, Parent, Admin)
- ✅ Children management endpoints
- ✅ Classes management endpoints
- ✅ Socket.io WebSocket support
- ✅ CORS configuration for cross-origin requests
- ✅ Health check endpoints

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory with:
   ```
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=password
   DB_NAME=skydek_DB
   DB_SSL=false
   
   # JWT Configuration
   JWT_SECRET=your-secret-key-change-in-production
   JWT_EXPIRES_IN=24h
   
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   ```

3. **Start the server:**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Health Check
- `GET /health` - Server health status
- `GET /api/health` - API health status
- `GET /` - Server info and available endpoints

### Authentication
- `POST /api/auth/teacher-login` - Teacher login
- `POST /api/auth/parent-login` - Parent login  
- `POST /api/auth/admin-login` - Admin login

### Children Management
- `GET /api/children` - Get all children (admin/teacher only)
- `GET /api/children/parent/:parentId` - Get children for a specific parent
- `GET /api/children/:childId` - Get child by ID

### Classes Management
- `GET /api/classes` - Get all classes
- `GET /api/classes/:classId` - Get class by ID
- `GET /api/classes/:classId/children` - Get children in a class (admin/teacher only)

## Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Database Schema Requirements

The API expects the following database tables:

- `staff` - Teacher and admin accounts
- `users` - Parent accounts  
- `children` - Child records
- `classes` - Class information

## Development

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Start local server
npm run local
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure proper database credentials
3. Set a secure `JWT_SECRET`
4. Run `npm start`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 3306 |
| `DB_USER` | Database username | root |
| `DB_PASSWORD` | Database password | password |
| `DB_NAME` | Database name | skydek_DB |
| `JWT_SECRET` | JWT signing secret | (required) |
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment | development |

## Security Features

- CORS protection
- Rate limiting
- Helmet security headers
- JWT token authentication
- Password hashing with bcrypt
- Input validation and sanitization

## License

MIT

---
*Last updated: 2025-07-05 - Railway deployment test*
