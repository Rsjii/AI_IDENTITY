import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { sanitizeInput } from '../../middleware/validation';
import { validateCSRF } from '../../middleware/csrf';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  dashboard,
  earnings,
  exportEarningsCSV,
  exportChatsCSV,
  requestPayout,
  setPricing,
  startTrial,
  connectStripeAccount,
  getStripeConnectStatus,
  recentChats,
  listChats,
  chatDetails,
} from './creatorController';

const router = Router();
router.use(requireJWTFromCookie);

router.get('/dashboard', asyncHandler(dashboard));
router.get('/earnings', asyncHandler(earnings));
router.get('/earnings/export', asyncHandler(exportEarningsCSV));
router.get('/chats/export', asyncHandler(exportChatsCSV));
router.post('/earnings/payout', sanitizeInput, validateCSRF, asyncHandler(requestPayout));

router.post('/pricing', sanitizeInput, validateCSRF, asyncHandler(setPricing));
router.post('/trial/start', sanitizeInput, validateCSRF, asyncHandler(startTrial));
router.post('/stripe/connect', validateCSRF, asyncHandler(connectStripeAccount));
router.get('/stripe/status', asyncHandler(getStripeConnectStatus));

router.get('/chats/recent', asyncHandler(recentChats));
router.get('/chats', asyncHandler(listChats));
router.get('/chats/:sessionId', asyncHandler(chatDetails));

export default router;