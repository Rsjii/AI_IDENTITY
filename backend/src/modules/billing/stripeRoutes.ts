import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRFOptional } from '../../middleware/csrf';
import { asyncHandler } from '../../middleware/errorHandler';
import { createCheckoutSession, stripeWebhook } from './stripeController';

const router = Router();

// subscription checkout (auth + CSRF)
router.post('/create-checkout-session', requireJWTFromCookie, validateCSRFOptional, asyncHandler(createCheckoutSession));

// webhook (raw body required in app.ts, no auth/CSRF needed)
router.post('/webhook', asyncHandler(stripeWebhook));

export default router;



