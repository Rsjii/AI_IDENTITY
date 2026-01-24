import { Router } from 'express';
import { requireJWTFromCookie } from '../middleware/jwtCookie';
import { requireAdmin } from '../middleware/admin';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/admin', requireJWTFromCookie, requireAdmin, asyncHandler(async (req: any, res) => {
  return res.render('pages/admin/index', {
    title: 'Admin Analytics',
    user: res.locals.user || req.user,
    csrfToken: res.locals.csrfToken || '',
  });
}));

router.get('/admin/users/:userId', requireJWTFromCookie, requireAdmin, asyncHandler(async (req: any, res) => {
  return res.render('pages/admin/user', {
    title: 'Admin — User',
    user: res.locals.user || req.user,
    csrfToken: res.locals.csrfToken || '',
    userId: req.params.userId,
  });
}));

export default router;