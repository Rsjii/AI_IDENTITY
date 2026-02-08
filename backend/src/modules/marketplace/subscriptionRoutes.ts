import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import { sanitizeInput } from '../../middleware/validation';
import { cancelSubscription, createSubscriptionCheckout, verifySubscriptionCheckout, getSubscriptionStatus, startSubscription } from './subscriptionController';

const router = Router();

router.post('/subscriptions/start', requireJWTFromCookie, validateCSRF, sanitizeInput, asyncHandler(startSubscription));
router.post('/subscriptions/checkout', requireJWTFromCookie, validateCSRF, sanitizeInput, asyncHandler(createSubscriptionCheckout));
router.post('/subscriptions/verify', requireJWTFromCookie, validateCSRF, sanitizeInput, asyncHandler(verifySubscriptionCheckout));
router.get('/subscriptions/status', requireJWTFromCookie, asyncHandler(getSubscriptionStatus));
router.post('/subscriptions/cancel', requireJWTFromCookie, validateCSRF, sanitizeInput, asyncHandler(cancelSubscription));

export default router;

