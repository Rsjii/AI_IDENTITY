import express, { Request, Response } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
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
import { generateCSRFToken } from './middleware/csrf';

// API routes
import authRoutes from './modules/auth/authRoutes';
import googleAuthRoutes from './modules/auth/googleAuthRoutes';
import identityRoutes from './modules/identity/identityRoutes';
import profileRoutes from './modules/profile/profileRoutes';
import adminRoutes from './modules/admin/adminRoutes';
import historyRoutes from './modules/history/historyRoutes';
import extensionRoutes from './modules/extension/extensionRoutes';
import extRoutes from './modules/extension/extRoutes';
import paymentRoutes from './modules/payment/paymentRoutes';
import voiceRoutes from './modules/voice/voiceRoutes';
import widgetRoutes from './modules/widget/widgetRoutes';
import instagramRoutes from './modules/instagram/instagramRoutes';
import whatsappRoutes from './modules/whatsapp/whatsappRoutes';
import stripeRoutes from './modules/billing/stripeRoutes';
import contentRoutes from './modules/content/contentRoutes';
import publicRoutes from './modules/public/publicRoutes';
import creatorRoutes from './modules/creator/creatorRoutes';
import payPerChatRoutes from './modules/payments/payPerChatRoutes';


// Page routes
import pageRoutes from './routes';

const PgSession = connectPgSimple(session);
const app = express();

// Global requestId middleware
app.use((req, res, next) => {
  const requestId = randomUUID();
  req.requestId = requestId;
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

// Stripe webhook needs raw body BEFORE json parser (only for that route)
app.use('/api/billing/stripe/webhook', express.raw({ type: 'application/json' }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// === EXTENSION CORS (Gmail content-script + Chrome extension) ===
// Allow Gmail origin (content script) and Chrome extension origins
app.use('/api/ext', (req, res, next) => {
  const origin = String(req.headers.origin || '');

  // ✅ Gmail origin (content script runs in Gmail page context)
  if (origin === 'https://mail.google.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
  }
  
  // ✅ Chrome extension origin (popup/background scripts)
  // Format: chrome-extension://[extension-id]
  if (origin.startsWith('chrome-extension://')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
  }

  // ✅ Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
});

// === WIDGET CORS (public embed on external websites) ===
app.use('/api/widget', (req, res, next) => {
  // Public endpoint: allow ANY origin, but NO credentials
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'false');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  return next();
});

// === INSTAGRAM WEBHOOK CORS (public for Meta webhooks) ===
app.use('/api/instagram/webhook', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hub-Signature-256');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  return next();
});

// === WHATSAPP WEBHOOK CORS (public for Twilio webhooks) ===
app.use('/api/whatsapp/webhook', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Twilio-Signature');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  return next();
});

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

// CSRF token endpoint for React SPA
app.get('/api/csrf', (req: Request, res: Response) => {
  generateCSRFToken(req, res, () => {
    res.json({ csrfToken: res.locals.csrfToken || '' });
  });
});

// Profile completion guard (block access until profile completed)
app.use(async (req, res, next) => {
  try {
    const isApiRequest = req.originalUrl.startsWith('/api/');
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

    // ✅ Allow home page for everyone
    if (path === '/' || path === '') {
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
      '/api/csrf', // ✅ Allow CSRF token fetch for React SPA (needed even if profile incomplete)
      // ✅ allow onboarding SPA routes
      '/onboarding',
      // ✅ allow onboarding APIs even if profile not completed yet
      '/api/identity',
      '/api/content',
      '/api/creator',
      '/api/payments',
      '/api/public',
      '/identity',
      '/mirror',
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
      if (isApiRequest) {
        return res.status(401).json({ error: 'Authentication required', errorCode: 'UNAUTHORIZED', redirect: '/auth' });
      }
      return res.redirect('/auth');
    }

    if (!fullUser.profileCompleted) {
      if (isApiRequest) {
        return res.status(403).json({ error: 'Profile not completed', errorCode: 'PROFILE_INCOMPLETE', redirect: '/auth' });
      }
      return res.redirect('/auth');
    }

    return next();
  } catch (err: any) {
    logger.error('ProfileCompletionGuard error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
    });
    // Don't redirect on error - let the request continue
    return next();
  }
});

// Global user exposure to EJS
app.use(async (req, res, next) => {
  if (req.originalUrl.startsWith('/api/')) return next();
  if (!res.locals.user && req.user) {
    try {
      const { userQueries } = await import('./config/database');
      const { ADMIN_EMAILS } = await import('./config/constants');
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
      // Set isAdmin flag
      res.locals.isAdmin = ADMIN_EMAILS.includes(String(req.user.email).toLowerCase());
    } catch (error) {
      res.locals.user = {
        id: req.user.userId || req.user.id,
        email: req.user.email,
        handle: req.user.handle,
        profileImage: null,
        hasPassword: false,
        hasGoogle: false,
      };
      res.locals.isAdmin = false;
    }
  } else if (res.locals.user && !res.locals.hasOwnProperty('isAdmin')) {
    // If user already set but isAdmin not set, check it
    const { ADMIN_EMAILS } = await import('./config/constants');
    res.locals.isAdmin = ADMIN_EMAILS.includes(String(res.locals.user.email).toLowerCase());
  }
  next();
});

// Global render wrapper
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/')) return next();
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

// ✅ ENHANCED: Request/Response logging middleware (before routes)
app.use((req, res, next) => {
  const start = Date.now();

  // Log request (body only in dev to avoid logging sensitive data)
  logger.info({
    method: req.method,
    path: req.path,
    query: req.query,
    ...(isDev && (req.method === 'POST' || req.method === 'PUT') ? { body: req.body } : {}),
    ip: req.ip,
  }, `📥 ${req.method} ${req.path}`);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';

    logger[logLevel]({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    }, `📤 ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
  });

  next();
});

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

// Page routes (HTML rendering) - Only in dev (React app serves pages in prod)
if (!isProd) {
  app.use('/', pageRoutes);
} else {
  // In production, return API info for root route
  app.get('/', (_req, res) => {
    res.json({
      message: 'Identity Mirror API',
      version: '1.0.0',
      frontend: config.frontendUrl || 'https://selflyx.com',
      docs: '/health'
    });
  });
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', googleAuthRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/extension', extensionRoutes);
app.use('/api/ext', extRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/widget', widgetRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/billing/stripe', stripeRoutes);
app.use('/api/payments/pay-per-chat', payPerChatRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/creator', creatorRoutes);

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
  if (isProd) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.status(404).render('errors/404', {
    title: 'Page Not Found',
    csrfToken: res.locals.csrfToken || '',
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
