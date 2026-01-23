import { Router } from 'express';
import authPageRoutes from './authPageRoutes';
import identityPageRoutes from './identityPageRoutes';
import { generateCSRFToken } from '../middleware/csrf';

const router = Router();

// Generate CSRF token for all page routes
router.use(generateCSRFToken);

// Auth pages
router.use(authPageRoutes);

// Identity pages
router.use(identityPageRoutes);

// Landing page
router.get('/', (req, res) => {
  return res.render('landing_mvp', {
    title: 'Identity Mirror',
    user: (res.locals as any).user || null,
    csrfToken: (res.locals as any).csrfToken || '',
  });
});

export default router;
