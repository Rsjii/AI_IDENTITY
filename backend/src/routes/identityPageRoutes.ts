import { Router } from 'express';
import { generateCSRFToken } from '../middleware/csrf';
import { requireJWTFromCookie } from '../middleware/jwtCookie';
import { asyncHandler } from '../middleware/errorHandler';
import { identityQueries } from '../config/database';

const router = Router();

// Generate CSRF token
router.use(generateCSRFToken);

// Identity setup page
router.get('/identity/setup', requireJWTFromCookie, asyncHandler(async (req: any, res) => {
  // Check if identity already exists
  const identity = await identityQueries.findByUserId(req.user.id);
  if (identity) {
    // Identity exists, redirect to mirror
    return res.redirect('/mirror');
  }

  return res.render('identity/identity-setup', {
    title: 'Setup Your Identity',
    user: res.locals.user || req.user,
    csrfToken: res.locals.csrfToken || '',
  });
}));

// Mirror page
router.get('/mirror', requireJWTFromCookie, asyncHandler(async (req: any, res) => {
  // Check if identity exists
  const identity = await identityQueries.findByUserId(req.user.id);
  if (!identity) {
    // No identity, redirect to setup
    return res.redirect('/identity/setup');
  }

  return res.render('identity/mirror', {
    title: 'Identity Mirror',
    user: res.locals.user || req.user,
    csrfToken: res.locals.csrfToken || '',
  });
}));

// Identity edit page
router.get('/identity/edit', requireJWTFromCookie, asyncHandler(async (req: any, res) => {
  // Check if identity exists
  const identity = await identityQueries.findByUserId(req.user.id);
  if (!identity) {
    // No identity, redirect to setup
    return res.redirect('/identity/setup');
  }

  return res.render('identity/identity-edit', {
    title: 'Edit Identity',
    user: res.locals.user || req.user,
    csrfToken: res.locals.csrfToken || '',
  });
}));

export default router;

