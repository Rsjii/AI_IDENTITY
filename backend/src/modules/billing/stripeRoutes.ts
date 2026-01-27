import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { asyncHandler } from '../../middleware/errorHandler';
import { createCheckoutSession, stripeWebhook } from './stripeController';

const router = Router();

// subscription checkout (auth)
router.post('/create-checkout-session', requireJWTFromCookie, asyncHandler(createCheckoutSession));

// webhook (raw body required in app.ts)
router.post('/webhook', asyncHandler(stripeWebhook));

export default router;


