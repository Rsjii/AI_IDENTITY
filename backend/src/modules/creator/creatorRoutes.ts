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
  getPricing,
  startTrial,
  updateOnboardingStep,
  completeOnboarding,
  connectStripeAccount,
  getStripeConnectStatus,
  recentChats,
  listChats,
  chatDetails,
  listSubscribers,
  getSetupStatus,
  updateSetupStep,
  dismissSetupBanner,
} from './creatorController';
import {
  listFiles,
  getStorageUsage,
  deleteFile
} from '../files/fileManagementController';

const router = Router();
router.use(requireJWTFromCookie);

router.get('/dashboard', asyncHandler(dashboard));
router.get('/earnings', asyncHandler(earnings));
router.get('/earnings/export', asyncHandler(exportEarningsCSV));
router.get('/chats/export', asyncHandler(exportChatsCSV));
router.post('/earnings/payout', sanitizeInput, validateCSRF, asyncHandler(requestPayout));

router.post('/pricing', sanitizeInput, validateCSRF, asyncHandler(setPricing));
router.get('/pricing', asyncHandler(getPricing));
router.post('/trial/start', sanitizeInput, validateCSRF, asyncHandler(startTrial));
router.post('/onboarding/step', sanitizeInput, validateCSRF, asyncHandler(updateOnboardingStep));
router.post('/onboarding/complete', sanitizeInput, validateCSRF, asyncHandler(completeOnboarding));
router.post('/stripe/connect', validateCSRF, asyncHandler(connectStripeAccount));
router.get('/stripe/status', asyncHandler(getStripeConnectStatus));

router.get('/chats/recent', asyncHandler(recentChats));
router.get('/chats', asyncHandler(listChats));
router.get('/chats/:sessionId', asyncHandler(chatDetails));
router.get('/subscribers', asyncHandler(listSubscribers));

// Setup tracking routes
router.get('/setup/status', asyncHandler(getSetupStatus));
router.post('/setup/step', sanitizeInput, validateCSRF, asyncHandler(updateSetupStep));
router.post('/setup/dismiss', validateCSRF, asyncHandler(dismissSetupBanner));

// File management routes
router.get('/files', asyncHandler(listFiles));
router.get('/storage', asyncHandler(getStorageUsage));
router.delete('/files/:id', validateCSRF, asyncHandler(deleteFile));

export default router;