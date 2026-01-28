import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { sanitizeInput } from '../../middleware/validation';
import { validateCSRF } from '../../middleware/csrf';
import { asyncHandler } from '../../middleware/errorHandler';
import { dashboard, earnings, exportEarningsCSV, exportChatsCSV, requestPayout, setPricing, startTrial } from './creatorController';

const router = Router();
router.use(requireJWTFromCookie);

router.get('/dashboard', asyncHandler(dashboard));
router.get('/earnings', asyncHandler(earnings));
router.get('/earnings/export', asyncHandler(exportEarningsCSV));
router.get('/chats/export', asyncHandler(exportChatsCSV));
router.post('/earnings/payout', sanitizeInput, validateCSRF, asyncHandler(requestPayout));

router.post('/pricing', sanitizeInput, validateCSRF, asyncHandler(setPricing));
router.post('/trial/start', sanitizeInput, validateCSRF, asyncHandler(startTrial));

export default router;