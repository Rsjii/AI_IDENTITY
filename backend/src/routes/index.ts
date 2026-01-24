import { Router } from 'express';
import authPageRoutes from './authPageRoutes';
import identityPageRoutes from './identityPageRoutes';
import adminPageRoutes from './adminPageRoutes';
import historyPageRoutes from './historyPageRoutes';
import { generateCSRFToken } from '../middleware/csrf';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../config/logger';

const router = Router();

// Generate CSRF token for all page routes
router.use(generateCSRFToken);

// Auth pages
router.use(authPageRoutes);

// Identity pages
router.use(identityPageRoutes);

// History pages
router.use(historyPageRoutes);

// Admin pages
router.use(adminPageRoutes);

// Landing page
router.get('/', asyncHandler(async (req, res) => {
  try {
    return res.render('marketing/landing_mvp', {
      title: 'Identity Mirror',
      user: res.locals.user || null,
      csrfToken: res.locals.csrfToken || '',
    });
  } catch (error: any) {
    logger.error('Error rendering landing page:', {
      error: error.message,
      stack: error.stack,
      path: req.path,
    });
    throw error;
  }
}));

export default router;
