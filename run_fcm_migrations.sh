#!/bin/bash

# FCM Tokens Migration Runner for Young Eagles School System
# This script runs the FCM token migrations for both databases

echo "🚀 Starting FCM Tokens Migration for Young Eagles School System"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Database credentials (update these with your actual credentials)
echo -e "${YELLOW}⚠️  Please ensure you have the correct database credentials configured${NC}"
echo "Database Host: [your_host]"
echo "Username: [your_username]"
echo "Databases: skydek_DB, railway"
echo ""

# Prompt for credentials
read -p "Enter MySQL host (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Enter MySQL username: " DB_USER
read -s -p "Enter MySQL password: " DB_PASS
echo ""

echo -e "${BLUE}📋 Migration Plan:${NC}"
echo "1. Create FCM tokens table in skydek_DB (for parents/children)"
echo "2. Create FCM tokens table in railway (for teachers/admins)"
echo "3. Create notifications tables in both databases"
echo ""

read -p "Continue with migration? (y/N): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}🔧 Running migrations...${NC}"

# Run skydek_DB migration
echo -e "${YELLOW}📊 Migrating skydek_DB (Parents/Children Database)...${NC}"
if mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" < src/migrations/skydek_DB_fcm_tokens.sql; then
    echo -e "${GREEN}✅ skydek_DB migration completed successfully!${NC}"
else
    echo -e "${RED}❌ skydek_DB migration failed!${NC}"
    exit 1
fi

echo ""

# Run railway migration
echo -e "${YELLOW}📊 Migrating railway (Teachers/Admin Database)...${NC}"
if mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" < src/migrations/railway_fcm_tokens.sql; then
    echo -e "${GREEN}✅ railway migration completed successfully!${NC}"
else
    echo -e "${RED}❌ railway migration failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 All migrations completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo "✅ FCM tokens table created in skydek_DB"
echo "✅ FCM tokens table created in railway"
echo "✅ Notifications tables created in both databases"
echo "✅ Proper indexes and constraints added"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Deploy your updated API server"
echo "2. Test FCM token registration"
echo "3. Test push notifications"
echo "4. Monitor the logs for any issues"
echo ""
echo -e "${GREEN}🚀 Your push notifications system is ready!${NC}"

