import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { query, testAllConnections } from './db.js';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import path from 'path';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simplified CORS configuration
const allowedOrigins = [
  'https://youngeagles-app.vercel.app',
  'https://app.youngeagles.org.za',
  'http://localhost:5173',
  'http://localhost:3002',
];

console.log('🔧 Starting MINIMAL server configuration...');
testAllConnections();

const app = express();

// Basic middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simplified CORS
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-request-source'],
  optionsSuccessStatus: 200,
}));

console.log('✅ Basic middleware configured');

// MINIMAL ROUTES - Start with just these basic endpoints

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: 'minimal-1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('🏠 Root endpoint requested');
  res.json({ 
    message: 'Young Eagles API Server - MINIMAL VERSION',
    version: 'minimal-1.0.0',
    status: 'active',
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api/test',
      'GET /api/minimal-test',
      'GET /api/test-db'
    ]
  });
});

// Simple API test endpoint
app.get('/api/test', (req, res) => {
  console.log('🧪 API test endpoint requested');
  res.json({
    message: 'API test endpoint working',
    timestamp: new Date().toISOString(),
    status: 'success'
  });
});

// Minimal test endpoint
app.get('/api/minimal-test', (req, res) => {
  console.log('⚡ Minimal test endpoint requested');
  res.json({
    message: 'Minimal API configuration is working',
    timestamp: new Date().toISOString(),
    server: 'minimal',
    routes: 'basic only'
  });
});

// Database test endpoint
app.get('/api/test-db', async (req, res) => {
  console.log('🗄️ Database test requested');
  try {
    const rows = await query('SELECT DATABASE() AS db, USER() AS user, VERSION() AS version');
    res.json({
      message: 'Database connection successful',
      db: rows[0].db,
      user: rows[0].user,
      version: rows[0].version,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Database test error:', error);
    res.status(500).json({ 
      message: 'Database connection failed', 
      error: error.message 
    });
  }
});

// 404 handler for unmatched routes
app.use('*', (req, res) => {
  console.log(`❓ 404 - Unmatched route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    message: 'Endpoint not found in minimal configuration',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /',
      'GET /health', 
      'GET /api/test',
      'GET /api/minimal-test',
      'GET /api/test-db'
    ]
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MINIMAL Server running on port ${PORT}`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚡ Mode: MINIMAL - Basic endpoints only`);
  console.log(`📋 Available endpoints:`);
  console.log(`   • GET /`);
  console.log(`   • GET /health`);
  console.log(`   • GET /api/test`);
  console.log(`   • GET /api/minimal-test`);
  console.log(`   • GET /api/test-db`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
}); 