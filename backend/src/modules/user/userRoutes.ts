import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { listMySubscriptions } from './userController';

const router = Router();
router.use(requireJWTFromCookie);

router.get('/subscriptions', asyncHandler(listMySubscriptions));

export default router;


