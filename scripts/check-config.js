#!/usr/bin/env node

/**
 * Young Eagles Preschool Platform - Configuration Validator
 * Validates all required environment variables and security settings
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`${colors.bold}${colors.cyan}${msg}${colors.reset}`)
};

let errorCount = 0;
let warningCount = 0;

function addError(message) {
  errorCount++;
  log.error(message);
}

function addWarning(message) {
  warningCount++;
  log.warning(message);
}

function checkRequired(envVar, description) {
  if (!process.env[envVar]) {
    addError(`Missing required environment variable: ${envVar} (${description})`);
    return false;
  }
  log.success(`${envVar}: Set`);
  return true;
}

function checkOptional(envVar, description) {
  if (!process.env[envVar]) {
    addWarning(`Optional environment variable not set: ${envVar} (${description})`);
    return false;
  }
  log.success(`${envVar}: Set`);
  return true;
}

function validateJWTSecret() {
  log.header('\n🔐 Validating JWT Security');
  
  if (!process.env.JWT_SECRET) {
    addError('JWT_SECRET is required');
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  
  if (jwtSecret.length < 32) {
    addError('JWT_SECRET must be at least 32 characters long');
  } else {
    log.success('JWT_SECRET length is secure');
  }

  // Check for common weak secrets
  const weakSecrets = [
    'secret',
    'mysecret',
    'jwt_secret',
    'your_secret_here',
    '12345',
    'password',
    'test'
  ];

  if (weakSecrets.includes(jwtSecret.toLowerCase())) {
    addError('JWT_SECRET appears to be a default/weak value');
  } else {
    log.success('JWT_SECRET appears to be unique');
  }

  // Check entropy
  const entropy = calculateEntropy(jwtSecret);
  if (entropy < 4) {
    addWarning('JWT_SECRET has low entropy - consider using a more random value');
  } else {
    log.success('JWT_SECRET has sufficient entropy');
  }
}

function calculateEntropy(str) {
  const freq = {};
  for (let char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  
  let entropy = 0;
  const len = str.length;
  for (let count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

function validateDatabase() {
  log.header('\n🗄️ Validating Database Configuration');
  
  checkRequired('DB_HOST', 'Database host');
  checkRequired('DB_USER', 'Database username');
  checkRequired('DB_PASSWORD', 'Database password');
  checkRequired('DB_NAME', 'Database name');
  
  const dbPort = process.env.DB_PORT || '3306';
  if (!/^\d+$/.test(dbPort) || parseInt(dbPort) < 1 || parseInt(dbPort) > 65535) {
    addError('DB_PORT must be a valid port number');
  } else {
    log.success('DB_PORT: Valid');
  }

  if (process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'true') {
    addWarning('DB_SSL should be enabled in production');
  } else if (process.env.DB_SSL === 'true') {
    log.success('DB_SSL: Enabled');
  }
}

function validateCORS() {
  log.header('\n🌐 Validating CORS Configuration');
  
  if (!process.env.ALLOWED_ORIGINS) {
    addError('ALLOWED_ORIGINS is required for production');
    return;
  }

  const origins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  
  for (const origin of origins) {
    if (origin === '*') {
      addError('Wildcard (*) CORS origin is not allowed in production');
    } else if (!origin.startsWith('https://') && process.env.NODE_ENV === 'production') {
      addWarning(`Non-HTTPS origin detected: ${origin}`);
    } else if (origin.startsWith('http://localhost')) {
      addWarning(`Localhost origin detected: ${origin} (should be removed in production)`);
    } else {
      log.success(`Valid origin: ${origin}`);
    }
  }
}

function validateSecurity() {
  log.header('\n🛡️ Validating Security Configuration');
  
  // Check bcrypt rounds
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  if (bcryptRounds < 10) {
    addWarning('BCRYPT_ROUNDS should be at least 10 for production');
  } else if (bcryptRounds > 15) {
    addWarning('BCRYPT_ROUNDS very high - may impact performance');
  } else {
    log.success(`BCRYPT_ROUNDS: ${bcryptRounds} (good)`);
  }

  // Check rate limiting
  const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
  const rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000;
  
  log.success(`Rate limiting: ${rateLimitMax} requests per ${rateLimitWindow/1000}s`);
}

function validateEmail() {
  log.header('\n📧 Validating Email Configuration');
  
  checkOptional('SMTP_HOST', 'SMTP server host');
  checkOptional('SMTP_PORT', 'SMTP server port');
  checkOptional('SMTP_USER', 'SMTP username');
  checkOptional('SMTP_PASSWORD', 'SMTP password');
  
  if (process.env.SMTP_USER && !process.env.SMTP_PASSWORD) {
    addWarning('SMTP_USER set but SMTP_PASSWORD missing');
  }
}

function validateAdmin() {
  log.header('\n👤 Validating Admin Configuration');
  
  if (!checkRequired('ADMIN_EMAIL', 'Administrator email address')) {
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(adminEmail)) {
    addError('ADMIN_EMAIL is not a valid email address');
  } else {
    log.success('ADMIN_EMAIL: Valid format');
  }

  if (process.env.ADMIN_DEFAULT_PASSWORD === 'CHANGE_ME_ON_FIRST_LOGIN') {
    addWarning('ADMIN_DEFAULT_PASSWORD is still set to default value');
  }
}

function validateFileSystem() {
  log.header('\n📁 Validating File System');
  
  const uploadsDir = process.env.UPLOAD_DIR || './uploads';
  const logsDir = './logs';
  
  // Check uploads directory
  if (!fs.existsSync(uploadsDir)) {
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
      log.success(`Created uploads directory: ${uploadsDir}`);
    } catch (error) {
      addError(`Cannot create uploads directory: ${uploadsDir}`);
    }
  } else {
    log.success(`Uploads directory exists: ${uploadsDir}`);
  }

  // Check logs directory
  if (!fs.existsSync(logsDir)) {
    try {
      fs.mkdirSync(logsDir, { recursive: true });
      log.success(`Created logs directory: ${logsDir}`);
    } catch (error) {
      addError(`Cannot create logs directory: ${logsDir}`);
    }
  } else {
    log.success(`Logs directory exists: ${logsDir}`);
  }

  // Check permissions
  try {
    fs.accessSync(uploadsDir, fs.constants.W_OK);
    log.success('Uploads directory is writable');
  } catch (error) {
    addError('Uploads directory is not writable');
  }

  try {
    fs.accessSync(logsDir, fs.constants.W_OK);
    log.success('Logs directory is writable');
  } catch (error) {
    addError('Logs directory is not writable');
  }
}

function validateEnvironment() {
  log.header('\n🌍 Validating Environment');
  
  const nodeEnv = process.env.NODE_ENV;
  if (!nodeEnv) {
    addError('NODE_ENV is not set');
  } else if (!['development', 'production', 'test'].includes(nodeEnv)) {
    addWarning(`Unusual NODE_ENV value: ${nodeEnv}`);
  } else {
    log.success(`NODE_ENV: ${nodeEnv}`);
  }

  if (nodeEnv === 'production') {
    if (process.env.DEBUG_MODE === 'true') {
      addWarning('DEBUG_MODE is enabled in production');
    }
    
    if (process.env.MOCK_PAYMENTS === 'true') {
      addWarning('MOCK_PAYMENTS is enabled in production');
    }
  }

  const port = parseInt(process.env.PORT) || 3001;
  if (port < 1024 && process.platform !== 'win32') {
    addWarning('Port < 1024 may require elevated privileges on Unix systems');
  } else {
    log.success(`PORT: ${port}`);
  }
}

function validateOptionalFeatures() {
  log.header('\n🚀 Validating Optional Features');
  
  // Firebase (PWA notifications)
  if (process.env.FIREBASE_PROJECT_ID) {
    log.success('Firebase configured for PWA notifications');
    checkOptional('FIREBASE_PRIVATE_KEY', 'Firebase private key');
    checkOptional('FIREBASE_CLIENT_EMAIL', 'Firebase client email');
  }

  // Payment processing
  if (process.env.STRIPE_SECRET_KEY || process.env.PAYFAST_MERCHANT_ID) {
    log.success('Payment processing configured');
  }

  // AI content generation
  if (process.env.OPENAI_API_KEY) {
    log.success('OpenAI configured for content generation');
  }

  // AWS for video storage
  if (process.env.AWS_ACCESS_KEY_ID) {
    log.success('AWS configured for video storage');
    checkOptional('AWS_SECRET_ACCESS_KEY', 'AWS secret key');
    checkOptional('AWS_S3_BUCKET', 'AWS S3 bucket');
  }

  // Monitoring
  if (process.env.SENTRY_DSN) {
    log.success('Sentry configured for error monitoring');
  }
}

function generateSummary() {
  log.header('\n📊 Configuration Summary');
  
  console.log(`\nValidation Results:`);
  console.log(`${colors.green}✅ Passed checks${colors.reset}`);
  
  if (warningCount > 0) {
    console.log(`${colors.yellow}⚠️  ${warningCount} warnings${colors.reset}`);
  }
  
  if (errorCount > 0) {
    console.log(`${colors.red}❌ ${errorCount} errors${colors.reset}`);
  }

  console.log('\nRecommendations:');
  
  if (errorCount > 0) {
    log.error('Configuration has critical issues that must be fixed before deployment');
    return false;
  } else if (warningCount > 0) {
    log.warning('Configuration has warnings - review before production deployment');
    return true;
  } else {
    log.success('Configuration is ready for production deployment!');
    return true;
  }
}

// Main validation
function main() {
  log.header('🔍 Young Eagles Preschool Platform - Configuration Validator\n');
  
  validateEnvironment();
  validateJWTSecret();
  validateDatabase();
  validateCORS();
  validateSecurity();
  validateEmail();
  validateAdmin();
  validateFileSystem();
  validateOptionalFeatures();
  
  const isValid = generateSummary();
  
  console.log('\n' + '='.repeat(60));
  
  process.exit(isValid ? 0 : 1);
}

main(); 