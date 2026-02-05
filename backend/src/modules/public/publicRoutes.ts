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

// Unified profile endpoint - works for both creators and end users
router.get('/profile/:handle', asyncHandler(getProfile));
// Keep old route for backward compatibility
router.get('/creator/:slug', asyncHandler(getCreator));

// ✅ Guest allowed (JWT optional because app.ts already runs extractJWTFromCookie globally)
router.get('/history', asyncHandler(publicHistory));
router.get('/message-limit', asyncHandler(publicMessageLimit));
router.post('/chat', publicChatRateLimit, asyncHandler(publicChat));
router.post('/feedback', asyncHandler(publicFeedback));

// ✅ After login, user can “claim” the guest session so it appears in /api/user/conversations
router.post('/claim-session', requireJWTFromCookie, asyncHandler(claimSession));

// ✅ After subscription checkout, unlock the latest teaser for this session
router.post('/unlock-by-subscription', requireJWTFromCookie, asyncHandler(unlockBySubscription));

router.post('/contact', contactFormRateLimit, contactFormDailyLimit, asyncHandler(submitContactForm));

export default router;