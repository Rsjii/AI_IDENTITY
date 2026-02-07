import app from './app';
import { config, isProd, isDev } from './config/env';
import { logger } from './config/logger';
import { db } from './config/db';
import { initializeDatabase } from './config/database';
import { initializePostHog, shutdownPostHog } from './services/posthogService';
import { validateEnv } from './config/envValidation';
import { initializeRazorpay } from './services/razorpayService';
import { processTrainingJobs } from './services/trainingJobService';

// Initialize Sentry (error tracking)
if (process.env.SENTRY_DSN && !isDev) {
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: config.nodeEnv,
      tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
      beforeSend(event) {
        // Don't send events in dev mode
        if (isDev) return null;
        return event;
      },
    });
    logger.info('✅ Sentry initialized for error tracking');
  } catch (error: any) {
    logger.warn('⚠️ Sentry initialization failed:', error.message);
  }
}

// ✅ NEW: Global process error handlers (MUST be before startServer)
process.on('uncaughtException', (error: Error) => {
  logger.error('❌ UNCAUGHT EXCEPTION - Process will exit', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
  
  // Attempt graceful shutdown
  shutdownPostHog();
  
  // Exit with error code so process manager restarts
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('❌ UNHANDLED REJECTION - Process will exit', {
    reason: reason instanceof Error ? {
      name: reason.name,
      message: reason.message,
      stack: reason.stack,
    } : reason,
    promise: promise.toString(),
    timestamp: new Date().toISOString(),
  });
  
  // Attempt graceful shutdown
  shutdownPostHog();
  
  // Exit with error code so process manager restarts
  process.exit(1);
});

// ✅ Pre-warm Groq API function
async function preWarmGroqAPI(): Promise<void> {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      logger.info('Groq API key not found, skipping pre-warm');
      return;
    }

    logger.info('Pre-warming Groq API...');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5
      })
    });

    if (response.ok) {
      logger.info('✅ Groq API pre-warmed successfully');
    } else {
      const errorText = await response.text();
      logger.warn(`⚠️ Groq API pre-warm failed: ${response.status} ${errorText}`);
    }
  } catch (error) {
    logger.warn('⚠️ Groq API pre-warm error:', error);
    // Don't fail startup if pre-warm fails
  }
}

async function startServer() {
  try {
    // ✅ Validate environment variables first (fail fast)
    validateEnv();
    
    // Initialize PostHog
    initializePostHog();

    // Initialize Razorpay (if payments enabled)
    initializeRazorpay();

    // Test database connection
    let dbConnected = false;

    try {
      await db.query('SELECT 1');
      dbConnected = true;
      logger.info('✅ Database connected successfully');
    } catch (dbError: any) {
      const errorCode = dbError?.code || 'NO_CODE';
      const errorMessage = dbError?.message || 'Unknown error';

      // Dev mode: allow boot without DB (DNS/network issues are common)
      if (config.appEnv === 'local' && (errorCode === 'ENOTFOUND' || errorCode === 'ETIMEDOUT' || errorCode === 'ECONNREFUSED')) {
        logger.warn('⚠️ Database connection failed in dev mode. Starting in degraded mode.');
        logger.warn(`   Error: ${errorCode} - ${errorMessage}`);
        logger.warn('   Skipping DB initialization. DB-dependent routes will fail until DNS/network is fixed.');
        dbConnected = false;
      } else {
        // In production or for other errors, fail fast
        logger.error('❌ Database connection failed:', {
          code: errorCode,
          message: errorMessage,
          hostname: errorMessage.includes('ENOTFOUND') ? 'DNS resolution failed - check DATABASE_URL hostname' : undefined,
        });
        throw dbError;
      }
    }

    // Initialize database tables only if DB is reachable
    if (dbConnected) {
      try {
        await initializeDatabase();
        logger.info('✅ Database tables initialized');
      } catch (dbError: any) {
        // ✅ In production, DB init failures are fatal (schema must be correct)
        // In dev, allow graceful degradation for local development
        if (isProd || config.nodeEnv === 'production') {
          logger.error('❌ Database initialization failed in production - this is fatal:', {
            err: dbError,
            message: dbError?.message || String(dbError),
            code: dbError?.code || 'NO_CODE',
            hint: 'Database schema must be initialized correctly. Check migration logs.',
          });
          throw dbError; // Fail fast in production
        } else {
          logger.warn('⚠️ Database initialization failed, continuing anyway (dev mode):', dbError?.message || dbError);
          // Continue startup in dev mode (tables might already exist, or DB might be unavailable)
        }
      }
    }

    // ✅ Pre-warm Groq API (non-blocking, don't wait for it)
    preWarmGroqAPI().catch(() => {
      // Ignore errors, don't block startup
    });

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Selflyx server running on port ${config.port}`);
      logger.info(`📊 Environment: ${config.nodeEnv}`);
      logger.info(`🔗 OpenAI API configured: ${config.openaiApiKey ? 'Yes' : 'No'}`);
      logger.info(`📧 Email configured: ${config.mail.smtp.user ? 'Yes' : 'No'}`);
      logger.info(`💾 Database: ${dbConnected ? '✅ Connected' : '⚠️ Degraded mode (DB unavailable)'}`);
    });

    // ✅ Background training job processor (runs every 2 minutes)
    setInterval(() => {
      processTrainingJobs().catch((err) => {
        logger.warn('[TrainingJobs] Processing failed:', err?.message || err);
      });
    }, 2 * 60 * 1000);

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof config.port === 'string' ? 'Pipe ' + config.port : 'Port ' + config.port;

      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`❌ ${bind} is already in use`);
          logger.error(`\n💡 To fix this:`);
          logger.error(`   1. Kill the process using port ${config.port}:`);
          logger.error(`      Windows: netstat -ano | findstr :${config.port}`);
          logger.error(`      Then: taskkill /PID <PID> /F`);
          logger.error(`   2. Or change PORT in .env file to a different port (e.g., 5001)`);
          logger.error(`   3. Or wait a few seconds for the port to be released\n`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    // ✅ Schedule weekly summary emails (every Monday at 9 AM)
    // Note: In production, use a proper cron service (e.g., node-cron, AWS EventBridge, etc.)
    if (config.nodeEnv === 'production') {
      try {
        const { sendWeeklySummariesToAllCreators } = await import('./services/weeklySummaryService');
        
        // Calculate milliseconds until next Monday 9 AM
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
        const nextMonday = new Date(now);
        nextMonday.setDate(now.getDate() + daysUntilMonday);
        nextMonday.setHours(9, 0, 0, 0);
        
        const msUntilNextMonday = nextMonday.getTime() - now.getTime();
        
        // Schedule first run
        setTimeout(() => {
          logger.info('📧 Starting weekly summary email job...');
          sendWeeklySummariesToAllCreators().catch((err) => {
            logger.error('Error in weekly summary job:', err);
          });
          
          // Then run every week (7 days)
          setInterval(() => {
            logger.info('📧 Starting weekly summary email job...');
            sendWeeklySummariesToAllCreators().catch((err) => {
              logger.error('Error in weekly summary job:', err);
            });
          }, 7 * 24 * 60 * 60 * 1000);
        }, msUntilNextMonday);
        
        logger.info(`📧 Weekly summary emails scheduled (next run: ${nextMonday.toISOString()})`);
      } catch (err: any) {
        logger.warn('Failed to schedule weekly summary emails:', err);
      }
    }

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      shutdownPostHog();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...');
      shutdownPostHog();
      process.exit(0);
    });

  } catch (error: any) {
    logger.error({ err: error }, 'Failed to start server');
    // ✅ Only log to console in dev mode (logger already handles production)
    if (isDev) {
      console.error('\n❌ SERVER STARTUP ERROR:', error?.message || error);
      if (error?.stack) console.error(error.stack);
    }
    process.exit(1);
  }
}

// Start the server
startServer();