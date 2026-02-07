import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  getCreator,
  getProfile,
  publicChat,
  publicFeedback,
  publicHistory,
  claimSession,
  publicMessageLimit,
  unlockBySubscription,
} from './publicController';
import { submitContactForm } from './contactController';
import { contactFormRateLimit, contactFormDailyLimit, publicChatRateLimit } from '../../middleware/rateLimit';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';

const router = Router();

// ✅ Keep creator/profile public (for chat page preview)
router.get('/profile/:handle', asyncHandler(getProfile));
router.get('/creator/:slug', asyncHandler(getCreator));

// ✅ LOGIN REQUIRED for all chat actions (login-first mode)
router.get('/history', requireJWTFromCookie, asyncHandler(publicHistory));
router.get('/message-limit', requireJWTFromCookie, asyncHandler(publicMessageLimit));
router.post('/chat', requireJWTFromCookie, publicChatRateLimit, asyncHandler(publicChat));
router.post('/feedback', requireJWTFromCookie, asyncHandler(publicFeedback));

// ✅ After login, user can "claim" the guest session so it appears in /api/user/conversations
router.post('/claim-session', requireJWTFromCookie, asyncHandler(claimSession));

// ✅ After subscription checkout, unlock the latest teaser for this session
router.post('/unlock-by-subscription', requireJWTFromCookie, asyncHandler(unlockBySubscription));

// ✅ Keep contact form public (optional)
router.post('/contact', contactFormRateLimit, contactFormDailyLimit, asyncHandler(submitContactForm));

export default router;