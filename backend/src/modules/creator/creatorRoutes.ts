import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { sanitizeInput } from '../../middleware/validation';
import { validateCSRF } from '../../middleware/csrf';
import { asyncHandler } from '../../middleware/errorHandler';
import { dashboard, earnings, setPricing, startTrial } from './creatorController';

const router = Router();
router.use(requireJWTFromCookie);

router.get('/dashboard', asyncHandler(dashboard));
router.get('/earnings', asyncHandler(earnings));

router.post('/pricing', sanitizeInput, validateCSRF, asyncHandler(setPricing));
router.post('/trial/start', sanitizeInput, validateCSRF, asyncHandler(startTrial));

export default router;