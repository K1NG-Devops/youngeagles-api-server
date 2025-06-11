# FCM Database Migration Commands

## Quick Setup for Your Two-Database System

You have two databases:
- **skydek_DB**: For parents and children
- **railway**: For teachers and admins

## Option 1: Run the Automated Script (Recommended)

```bash
# Make the script executable
chmod +x run_fcm_migrations.sh

# Run the migration script
./run_fcm_migrations.sh
```

## Option 2: Manual Database Commands

### For skydek_DB (Parents/Children Database)

```sql
-- Connect to your MySQL server and run:
mysql -u your_username -p

-- Then run the migration file:
source /path/to/skydek_DB_fcm_tokens.sql;
```

### For railway (Teachers/Admin Database)

```sql
-- Connect to your MySQL server and run:
mysql -u your_username -p

-- Then run the migration file:
source /path/to/railway_fcm_tokens.sql;
```

## Option 3: Remote Database (If using hosted MySQL)

```bash
# For skydek_DB
mysql -h your_host -u your_username -p skydek_DB < src/migrations/skydek_DB_fcm_tokens.sql

# For railway
mysql -h your_host -u your_username -p railway < src/migrations/railway_fcm_tokens.sql
```

## Verification Commands

After running the migrations, verify they worked:

```sql
-- Check skydek_DB
USE skydek_DB;
SHOW TABLES LIKE '%fcm%';
DESCRIBE fcm_tokens;
SELECT COUNT(*) FROM fcm_tokens;

-- Check railway
USE railway;
SHOW TABLES LIKE '%fcm%';
DESCRIBE fcm_tokens;
SELECT COUNT(*) FROM fcm_tokens;
```

## What Gets Created

### In Both Databases:
1. **fcm_tokens table** - Stores Firebase Cloud Messaging tokens
2. **notifications table** - Stores notification history
3. **Proper indexes** for performance
4. **Foreign key constraints** for data integrity

### Table Structure:
```sql
fcm_tokens:
- id (Primary Key)
- user_id (Foreign Key to users.id)
- user_type (parent/child for skydek_DB, teacher/admin for railway)
- token (Firebase token)
- device_type (web/mobile)
- device_info (JSON - browser/device details)
- is_active (boolean)
- last_used (timestamp)
- created_at, updated_at
```

## Troubleshooting

### If migration fails:
1. **Check database permissions**: Ensure your user can CREATE, ALTER, INSERT
2. **Check database exists**: Verify skydek_DB and railway databases exist
3. **Check foreign key constraints**: Ensure `users` table exists in both databases
4. **Check file paths**: Ensure migration SQL files are in the correct location

### Common errors:
- `Table 'users' doesn't exist`: The migration assumes you have a `users` table
- `Access denied`: Your database user needs CREATE and ALTER permissions
- `Unknown database`: Double-check database names are correct

## VAPID Key Status ✅

Your VAPID key is already configured:
```
vapidKey: 'BO2hxrIVytQl5yxMOTx1IZ1HouNRQoU-55remyWPPDHmhaWTnv2dm6v-45TCjng0DdQAjSbzbp5FLTtIIDDl0mQ'
```

No additional Firebase Console setup needed for the VAPID key! ✅

## Next Steps After Migration

1. **Deploy your updated API server** with the new FCM endpoints
2. **Test the FCM token registration** by logging in as different user types
3. **Test push notifications** by triggering homework submissions, etc.
4. **Monitor your server logs** for any FCM-related errors

## Testing FCM Token Registration

After deployment, you can test with:

```bash
# Check if tokens are being saved
curl -X GET "https://your-api-url/api/fcm/tokens" \
  -H "Authorization: Bearer your_token"
```

Your push notifications should now work correctly! 🎉

