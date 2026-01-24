import { Router } from 'express';
import { requireJWTFromCookie } from '../middleware/jwtCookie';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/history', requireJWTFromCookie, asyncHandler(async (req: any, res) => {
  return res.render('pages/history/index', {
    title: 'History',
    user: res.locals.user || req.user,
    csrfToken: res.locals.csrfToken || '',
  });
}));

export default router;