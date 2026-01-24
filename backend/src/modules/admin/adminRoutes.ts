import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { requireAdmin } from '../../middleware/admin';
import { asyncHandler } from '../../middleware/errorHandler';
import { overview, users, userDetail } from './adminController';

const router = Router();
router.use(requireJWTFromCookie);
router.use(requireAdmin);

router.get('/overview', asyncHandler(overview));
router.get('/users', asyncHandler(users));
router.get('/users/:userId', asyncHandler(userDetail));

export default router;