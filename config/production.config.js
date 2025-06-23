/**
 * Young Eagles Preschool Platform - Production Configuration
 * Secure configuration management for production deployment
 * Built for scalability and multi-tenancy
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'DB_HOST',
  'DB_USER', 
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'ADMIN_EMAIL'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// Production Configuration
export const config = {
  // Application
  app: {
    name: 'Young Eagles Preschool Platform',
    version: process.env.API_VERSION || '2.0.0',
    environment: process.env.NODE_ENV || 'production',
    port: parseInt(process.env.PORT) || 3001,
    debug: process.env.DEBUG_MODE === 'true'
  },

  // Database Configuration
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20,
    acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
    timeout: parseInt(process.env.DB_TIMEOUT) || 60000,
    reconnect: true
  },

  // Security Configuration
  security: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    sessionSecret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },

  // CORS Configuration
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'https://youngeagles.com',
      'https://app.youngeagles.com',
      'https://admin.youngeagles.com'
    ],
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || ['jpg', 'jpeg', 'png', 'pdf', 'mp4', 'mov', 'avi']
  },

  // Email Configuration
  email: {
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    },
    from: {
      email: process.env.FROM_EMAIL || 'noreply@youngeagles.com',
      name: process.env.FROM_NAME || 'Young Eagles Platform'
    }
  },

  // Firebase Configuration (for PWA)
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    databaseURL: process.env.FIREBASE_DATABASE_URL
  },

  // Payment Configuration (Future scaling)
  payments: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    },
    payfast: {
      merchantId: process.env.PAYFAST_MERCHANT_ID,
      merchantKey: process.env.PAYFAST_MERCHANT_KEY,
      passphrase: process.env.PAYFAST_PASSPHRASE
    }
  },

  // AWS Configuration (Video compression & storage)
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'af-south-1',
    s3Bucket: process.env.AWS_S3_BUCKET,
    cloudFrontUrl: process.env.AWS_CLOUDFRONT_URL
  },

  // AI Configuration (Content generation)
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    model: process.env.CONTENT_GENERATION_MODEL || 'gpt-4'
  },

  // Monitoring & Logging
  monitoring: {
    logLevel: process.env.LOG_LEVEL || 'info',
    sentryDsn: process.env.SENTRY_DSN,
    analyticsKey: process.env.ANALYTICS_KEY
  },

  // Admin Configuration
  admin: {
    email: process.env.ADMIN_EMAIL,
    defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || 'CHANGE_ME_ON_FIRST_LOGIN'
  },

  // Multi-tenancy Configuration (Preschool Platform)
  platform: {
    enableMultiTenancy: process.env.ENABLE_MULTI_TENANCY === 'true',
    defaultSubscriptionPlan: process.env.DEFAULT_SUBSCRIPTION_PLAN || 'basic',
    subscriptionPlans: process.env.SUBSCRIPTION_PLANS?.split(',') || ['basic', 'premium', 'enterprise']
  },

  // Performance Configuration
  performance: {
    cacheEnabled: process.env.CACHE_ENABLED === 'true',
    redisUrl: process.env.REDIS_URL,
    cdnEnabled: process.env.CDN_ENABLED === 'true'
  },

  // Content Security
  content: {
    moderationEnabled: process.env.CONTENT_MODERATION_ENABLED === 'true',
    autoBackupEnabled: process.env.AUTO_BACKUP_ENABLED === 'true',
    backupIntervalHours: parseInt(process.env.BACKUP_INTERVAL_HOURS) || 24
  }
};

// Validate critical configurations
if (!config.security.jwtSecret || config.security.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

if (!config.database.host || !config.database.user || !config.database.password) {
  throw new Error('Database configuration is incomplete');
}

export default config; 