/**
 * Young Eagles Preschool Platform - Production Logger
 * Structured logging with different levels and output formats
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = ' ' + JSON.stringify(meta);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'young-eagles-api',
    version: process.env.API_VERSION || '2.0.0'
  },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Combined logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Database logs
    new winston.transports.File({
      filename: path.join(logsDir, 'database.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 3
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Helper functions for different log types
export const Logger = {
  // System startup and configuration
  startup: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'startup' });
  },

  // Database operations
  database: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'database' });
  },

  // Authentication and security
  auth: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'auth' });
  },

  // API requests
  request: (req, res) => {
    const startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info('API Request', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        category: 'request'
      });
    });
  },

  // Homework and content management
  homework: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'homework' });
  },

  // Messaging system
  messaging: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'messaging' });
  },

  // File uploads
  upload: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'upload' });
  },

  // Payment processing (future)
  payment: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'payment' });
  },

  // Multi-tenancy operations (future)
  tenant: (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'tenant' });
  },

  // General info logging
  info: (message, meta = {}) => {
    logger.info(message, meta);
  },

  // Warning logging
  warn: (message, meta = {}) => {
    logger.warn(message, meta);
  },

  // Error logging
  error: (message, error = null, meta = {}) => {
    const errorMeta = { ...meta };
    if (error) {
      errorMeta.error = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    }
    logger.error(message, errorMeta);
  },

  // Debug logging (only in development)
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(message, meta);
    }
  },

  // Security events
  security: (message, meta = {}) => {
    logger.warn(message, { ...meta, category: 'security' });
  },

  // Performance monitoring
  performance: (operation, duration, meta = {}) => {
    logger.info(`Performance: ${operation}`, {
      ...meta,
      duration: `${duration}ms`,
      category: 'performance'
    });
  }
};

// Express middleware for request logging
export const requestLogger = (req, res, next) => {
  Logger.request(req, res);
  next();
};

// Error handling middleware
export const errorLogger = (error, req, res, next) => {
  Logger.error('Unhandled API Error', error, {
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    params: req.params,
    query: req.query
  });
  next(error);
};

// Graceful shutdown logging
export const shutdownLogger = () => {
  return new Promise((resolve) => {
    Logger.startup('Application shutting down gracefully');
    logger.end(() => {
      resolve();
    });
  });
};

export default Logger; 