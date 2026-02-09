import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { listMySubscriptions, getUserDashboard } from './userController';

const router = Router();
router.use(requireJWTFromCookie);

router.get('/dashboard', asyncHandler(getUserDashboard));
router.get('/subscriptions', asyncHandler(listMySubscriptions));

export default router;


