import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import passport from 'passport';

import { config, isProd, isDev } from './config/env';
import { logger } from './config/logger';
import { db } from './config/database';
import { pool } from './config/db';
import { errorHandlerMiddleware } from './middleware/errorHandler';
import { globalRateLimit } from './middleware/rateLimit';
import { extractJWTFromCookie } from './middleware/jwtCookie';

// API routes
import authRoutes from './modules/auth/authRoutes';
import googleAuthRoutes from './modules/auth/googleAuthRoutes';
import identityRoutes from './modules/identity/identityRoutes';

// Page routes
import pageRoutes from './routes';

const PgSession = connectPgSimple(session);
const app = express();

// Global requestId middleware
app.use((req, res, next) => {
  const requestId = randomUUID();
  (req as any).requestId = requestId;
  res.locals.requestId = requestId;
  next();
});

app.set('etag', false);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
    },
  },
}));

app.use(compression());

// Rate limiting
if (isProd) {
  app.use(globalRateLimit);
}

app.use(cookieParser());
app.use(extractJWTFromCookie);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.set('trust proxy', 1);

// Session middleware
const forceInsecureCookies = process.env.FORCE_INSECURE_COOKIES === 'true';
const sessionCookieSecure = isProd && !forceInsecureCookies;

const sessionStore = new PgSession({
  pool: pool,
  tableName: 'session',
  createTableIfMissing: true,
});

app.use(session({
  store: sessionStore,
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: 'connect.sid',
  cookie: {
    secure: sessionCookieSecure,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

// Profile completion guard (block access until profile completed)
app.use(async (req, res, next) => {
  try {
    const path = req.path || '';

    // Skip static assets
    const isStatic =
      path.startsWith('/css/') ||
      path.startsWith('/js/') ||
      path.startsWith('/images/') ||
      path.startsWith('/uploads/') ||
      path.startsWith('/utils/') ||
      path.startsWith('/favicon') ||
      path.endsWith('.png') ||
      path.endsWith('.jpg') ||
      path.endsWith('.jpeg') ||
      path.endsWith('.svg') ||
      path.endsWith('.ico') ||
      path.endsWith('.woff') ||
      path.endsWith('.woff2') ||
      path.endsWith('.ttf') ||
      path.endsWith('.css') ||
      path.endsWith('.js');

    if (isStatic) {
      return next();
    }

    // If not logged in, nothing to do
    if (!req.user || !req.user.email) {
      return next();
    }

    // Routes where incomplete profile is allowed
    const allowedPrefixes = [
      '/auth',
      '/login',
      '/signup',
      '/signup/profile',
      '/signup/verify',
      '/forgot-password',
      '/reset-password',
      '/api/auth',
    ];

    const isAllowed = allowedPrefixes.some(prefix => path.startsWith(prefix));
    if (isAllowed) {
      return next();
    }

    // For everything else: check profileCompleted
    const { userQueries } = await import('./config/database');
    const fullUser = await userQueries.findByEmail(req.user.email);

    if (!fullUser) {
      res.clearCookie('jwtToken', {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'lax' : 'strict',
        path: '/',
      });
      if (req.session) {
        req.session.destroy(() => {});
      }
      return res.redirect('/auth');
    }

    if (!fullUser.profileCompleted) {
      return res.redirect('/auth');
    }

    return next();
  } catch (err) {
    logger.error('ProfileCompletionGuard error:', err);
    return res.redirect('/auth');
  }
});

// Global user exposure to EJS
app.use(async (req, res, next) => {
  if (!res.locals.user && req.user) {
    try {
      const { userQueries } = await import('./config/database');
      const fullUser = await userQueries.findByEmail(req.user.email);

      if (fullUser) {
        res.locals.user = {
          id: req.user.userId || req.user.id,
          email: req.user.email,
          handle: req.user.handle,
          name: fullUser.name,
          profileImage: fullUser.profileImage || null,
          hasPassword: !!fullUser.passwordHash,
          hasGoogle: !!fullUser.googleId,
        };
      } else {
        res.locals.user = {
          id: req.user.userId || req.user.id,
          email: req.user.email,
          handle: req.user.handle,
          profileImage: null,
          hasPassword: false,
          hasGoogle: false,
        };
      }
    } catch (error) {
      res.locals.user = {
        id: req.user.userId || req.user.id,
        email: req.user.email,
        handle: req.user.handle,
        profileImage: null,
        hasPassword: false,
        hasGoogle: false,
      };
    }
  }
  next();
});

// Global render wrapper
app.use((req, res, next) => {
  const originalRender = res.render.bind(res);

  res.render = (view: string, options?: any, callback?: any) => {
    const opts = options || {};

    if ((!("user" in opts) || opts.user == null) && res.locals.user) {
      opts.user = res.locals.user;
    }

    return originalRender(view, opts, callback as any);
  };

  next();
});

// Logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// View engine setup
app.set('view engine', 'ejs');
const viewsPath = path.resolve(__dirname, '../../frontend/src/views');
app.set('views', viewsPath);
app.set('view cache', config.nodeEnv === 'production');

// Static files
const staticOptions = config.nodeEnv === 'production' 
  ? { maxAge: '1y', etag: true, lastModified: true }
  : { maxAge: 0, etag: false, lastModified: false };

app.use(express.static(path.resolve(__dirname, '../../frontend/src/public'), staticOptions));

// Uploads
const uploadsPath = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), 'public/uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Initialize Passport (for Google OAuth)
app.use(passport.initialize());
app.use(passport.session());

// ========== ROUTE MOUNTING ==========
// Page routes (HTML rendering)
app.use('/', pageRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', googleAuthRoutes);
app.use('/api/identity', identityRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Dev-only email test endpoint
if (isDev) {
  app.get('/api/test/email', async (req, res) => {
    try {
      const { EmailService } = await import('./modules/auth/authService');
      const testEmail = req.query.email as string || 'test@example.com';
      const emailService = new EmailService();
      const result = await emailService.sendOTP(testEmail, '123456', 'signup');
      
      res.json({
        success: result,
        message: result ? 'Email sent successfully' : 'Email sending failed',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('❌ [EMAIL_TEST] Test failed:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
}

// Error handling middleware (must be after all routes)
app.use(errorHandlerMiddleware);

// 404 handler
app.use((_req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found',
    csrfToken: res.locals['csrfToken'] || '',
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  await db.close();
  process.exit(0);
});

export default app;
