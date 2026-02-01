import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { getCreator, publicChat, publicFeedback, publicHistory } from './publicController';
import { submitContactForm } from './contactController';
import { contactFormRateLimit, contactFormDailyLimit, publicChatRateLimit } from '../../middleware/rateLimit';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';

const router = Router();

router.get('/creator/:slug', asyncHandler(getCreator));

// ✅ require login for chat + history (+ feedback)
router.get('/history', requireJWTFromCookie, asyncHandler(publicHistory));
router.post('/chat', requireJWTFromCookie, publicChatRateLimit, asyncHandler(publicChat));
router.post('/feedback', requireJWTFromCookie, asyncHandler(publicFeedback));

router.post('/contact', contactFormRateLimit, contactFormDailyLimit, asyncHandler(submitContactForm));

export default router;