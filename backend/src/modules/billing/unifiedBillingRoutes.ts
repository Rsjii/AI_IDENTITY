import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRFOptional, validateCSRF } from '../../middleware/csrf';
import { asyncHandler } from '../../middleware/errorHandler';
import { checkout, verifyRazorpayCheckout, lemonSqueezyWebhook } from './unifiedBillingController';

const router = Router();

// Start checkout (LemonSqueezy redirect OR Razorpay order)
router.post('/checkout', requireJWTFromCookie, validateCSRFOptional, asyncHandler(checkout));

// Razorpay finalize (server-side signature verification + plan unlock)
router.post('/razorpay/verify', requireJWTFromCookie, validateCSRF, asyncHandler(verifyRazorpayCheckout));

// ✅ Lemon webhook (raw body; no auth/CSRF)
router.post('/lemonsqueezy/webhook', asyncHandler(lemonSqueezyWebhook));

export default router;