import dotenv from 'dotenv';
dotenv.config();

import { app, server } from './config/server.js';
import { initDatabase } from './db.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import childrenRoutes from './routes/children.routes.js';
import classesRoutes from './routes/classes.routes.js';
import homeworkRoutes from './routes/homework.routes.js';
import parentRoutes from './routes/parent.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import activitiesRoutes from './routes/activities.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import pushRoutes from './routes/push.routes.js';
import aiRoutes from './routes/ai.routes.js';
import usersRoutes from './routes/users.routes.js';
import adsRoutes from './routes/ads.routes.js';
import subscriptionsRoutes from './routes/subscriptions.routes.js';
import webhooksRoutes from './routes/webhooks.routes.js';
import migrationRoutes from './routes/migration.routes.js';

const PORT = process.env.PORT || 3001;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Young Eagles API - Minimal',
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Young Eagles API - Minimal',
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Young Eagles API - Minimal Version',
    version: '1.0.0',
    status: 'Running',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      children: '/api/children',
      classes: '/api/classes',
      homework: '/api/homework',
      parent: '/api/parent',
      teacher: '/api/teacher',
      activities: '/api/activities',
      attendance: '/api/attendance',
      notifications: '/api/notifications',
      users: '/api/users',
      ads: '/api/ads',
      subscriptions: '/api/subscriptions',
      migration: '/api/migration',
      webhooks: '/webhooks'
    }
  });
});

// Register API routes
app.use('/api/auth', authRoutes);
app.use('/api/children', childrenRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/webhooks', webhooksRoutes);

// Error handling middleware
app.use((error, req, res, _next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler (must be last)
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Initialize and start server
async function startServer() {
  console.log('🚀 Starting Young Eagles API Server (Minimal)...');
  
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
  console.log('📍 Environment:', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
  
  // Try to connect to database
  console.log('🔌 Attempting database connection...');
  const dbConnected = await initDatabase();
  
  if (!dbConnected) {
    console.log('⚠️ Database connection failed - continuing with limited functionality');
    console.log('⚠️ Only health check endpoints will work');
  } else {
    console.log('✅ Database connected successfully');
    
    // Create missing tables automatically on startup
    try {
      console.log('📝 Creating missing database tables...');
      const { execute } = await import('./db.js');
      
      // Create subscriptions table
      await execute(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          plan_id VARCHAR(50) NOT NULL,
          plan_name VARCHAR(100) NOT NULL,
          price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
          price_annual DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
          billing_cycle ENUM('monthly', 'annual') NOT NULL DEFAULT 'monthly',
          status ENUM('active', 'cancelled', 'expired', 'suspended', 'trial') NOT NULL DEFAULT 'active',
          payment_method ENUM('payfast', 'stripe', 'manual', 'bank_transfer') NOT NULL DEFAULT 'payfast',
          payment_gateway_id VARCHAR(255) DEFAULT NULL,
          subscription_start_date DATETIME NOT NULL,
          subscription_end_date DATETIME NOT NULL,
          next_billing_date DATETIME NOT NULL,
          auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
          trial_end_date DATETIME DEFAULT NULL,
          created_by INT DEFAULT NULL,
          cancelled_at DATETIME DEFAULT NULL,
          cancelled_by INT DEFAULT NULL,
          cancellation_reason TEXT DEFAULT NULL,
          metadata JSON DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          
          INDEX idx_user_id (user_id),
          INDEX idx_status (status)
        )
      `);
      
      // Create subscription_features table
      await execute(`
        CREATE TABLE IF NOT EXISTS subscription_features (
          id INT AUTO_INCREMENT PRIMARY KEY,
          plan_id VARCHAR(50) NOT NULL,
          feature_name VARCHAR(100) NOT NULL,
          feature_limit INT DEFAULT NULL,
          is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          INDEX idx_plan_id (plan_id),
          INDEX idx_feature_name (feature_name),
          
          UNIQUE KEY unique_plan_feature (plan_id, feature_name)
        )
      `);
      
      // Insert default subscription features
      await execute(`
        INSERT INTO subscription_features (plan_id, feature_name, feature_limit, is_enabled) VALUES
        ('free', 'basic_homework', 5, TRUE),
        ('free', 'basic_activities', 3, TRUE),
        ('free', 'limited_storage', 100, TRUE),
        ('free', 'ads_enabled', NULL, TRUE)
        ON DUPLICATE KEY UPDATE 
          feature_limit = VALUES(feature_limit),
          is_enabled = VALUES(is_enabled)
      `);
      
      console.log('✅ Database tables created/verified successfully');
    } catch (error) {
      console.log('⚠️ Failed to create tables (might already exist):', error.message);
    }
    
    // Initialize billing automation if in production or explicitly enabled
    if (isProduction || process.env.ENABLE_BILLING_AUTOMATION === 'true') {
      try {
        console.log('⚙️ Initializing billing automation...');
        const { default: billingService } = await import('./services/billingService.js');
        
        // Test billing system
        const testResult = await billingService.testBillingSystem();
        if (testResult.success) {
          billingService.init();
          console.log('✅ Billing automation initialized successfully');
        } else {
          console.log('⚠️ Billing system test failed, skipping automation:', testResult.error);
        }
      } catch (error) {
        console.log('⚠️ Failed to initialize billing automation:', error.message);
      }
    } else {
      console.log('ℹ️ Billing automation disabled (set ENABLE_BILLING_AUTOMATION=true to enable)');
    }
  }
  
  // Start server
  server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    
    if (isProduction) {
      const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` 
        : `https://youngeagles-api.railway.app`; // fallback
      console.log(`🌐 Production: ${railwayUrl}`);
      console.log(`💓 Health check: ${railwayUrl}/health`);
      console.log('🚀 Production server ready for requests');
    } else {
      console.log(`🌐 Local: http://localhost:${PORT}`);
      console.log(`💓 Health check: http://localhost:${PORT}/health`);
      console.log('🔧 Development server ready');
    }
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    
    // Stop billing automation
    if (global.billingService) {
      global.billingService.stop();
    }
    
    server.close(() => {
      console.log('Process terminated');
    });
  });
}

// Start the server
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}); 