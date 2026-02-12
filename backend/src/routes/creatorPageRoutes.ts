import { Router } from 'express';
import { generateCSRFToken } from '../middleware/csrf';
import { requireJWTFromCookie } from '../middleware/jwtCookie';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Generate CSRF token
router.use(generateCSRFToken);

// File management page
router.get('/files', requireJWTFromCookie, asyncHandler(async (req: any, res) => {
  return res.render('creator/files', {
    title: 'File Management',
    user: res.locals.user || req.user,
    csrfToken: res.locals.csrfToken || '',
  });
}));

// Settings/Billing page (for plan management)
router.get('/settings/billing', requireJWTFromCookie, asyncHandler(async (req: any, res) => {
  return res.render('creator/billing', {
    title: 'Billing & Plans',
    user: res.locals.user || req.user,
    csrfToken: res.locals.csrfToken || '',
  });
}));

export default router;
