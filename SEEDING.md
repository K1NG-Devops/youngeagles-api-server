# Database Seeding Guide

## Admin Setup

This project uses a clean seeding approach that preserves existing data while setting up the necessary admin user.

### Running the Admin Seeder

```bash
node seedAdmin.js
```

### What it does:

1. **Creates staff table if not exists** - Safe for existing databases
2. **Seeds admin user** with the following credentials:
   - Email: `admin@youngeagles.org.za`
   - Password: `Admin@123`
   - Role: `admin`
   - Verified: `true`

### After Setup:

1. Log into the admin dashboard with the above credentials
2. Add teachers through the admin interface (no more hardcoded teacher data!)
3. Manage all staff through the dashboard

### Benefits:

- ✅ Preserves existing user data
- ✅ No hardcoded teacher credentials
- ✅ Clean separation of concerns
- ✅ Teachers managed through admin dashboard
- ✅ Safe to run multiple times (idempotent)

### Database Structure:

The `staff` table includes:
- `id` - Auto increment primary key
- `name` - Staff member name
- `email` - Unique email address
- `password` - Bcrypt hashed password
- `role` - Either 'admin' or 'teacher'
- `created_at` - Timestamp
- `is_verified` - Boolean flag
- `reset_token` - For password resets
- `reset_token_expires` - Token expiry timestamp

