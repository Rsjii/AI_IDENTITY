import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import { sanitizeInput } from '../../middleware/validation';
import { createPayPerChatIntent, confirmPayPerChatRazorpay } from './payPerChatController';

const router = Router();

// ✅ Login-first mode: require JWT + CSRF
router.post('/pay-per-chat/intent', requireJWTFromCookie, validateCSRF, sanitizeInput, asyncHandler(createPayPerChatIntent));
router.post('/pay-per-chat/confirm', requireJWTFromCookie, validateCSRF, sanitizeInput, asyncHandler(confirmPayPerChatRazorpay));

export default router;
