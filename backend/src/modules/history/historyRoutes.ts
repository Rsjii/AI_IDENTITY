import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { asyncHandler } from '../../middleware/errorHandler';
import { overview, runs } from './historyController';

const router = Router();
router.use(requireJWTFromCookie);

router.get('/overview', asyncHandler(overview));
router.get('/runs', asyncHandler(runs));

export default router;