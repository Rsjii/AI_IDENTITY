import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRFOptional, validateCSRF } from '../../middleware/csrf';
import { asyncHandler } from '../../middleware/errorHandler';
import { createCheckoutSession, stripeWebhook } from './stripeController';
import { upgradePlan, downgradePlan, cancelSubscription } from './subscriptionService';

const router = Router();

// subscription checkout (auth + CSRF)
router.post('/create-checkout-session', requireJWTFromCookie, validateCSRFOptional, asyncHandler(createCheckoutSession));

// ✅ ADD: Subscription management endpoints
router.post('/upgrade', requireJWTFromCookie, validateCSRF, asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { plan } = req.body;
  if (!['starter', 'growth', 'scale'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  
  const result = await upgradePlan(userId, plan);
  if (result.success) {
    return res.json({ success: true, message: 'Plan upgraded successfully' });
  }
  return res.status(400).json({ error: result.error || 'Upgrade failed' });
}));

router.post('/downgrade', requireJWTFromCookie, validateCSRF, asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { plan } = req.body;
  if (!['starter', 'growth', 'free'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  
  const result = await downgradePlan(userId, plan);
  if (result.success) {
    return res.json({ success: true, message: 'Plan downgraded successfully' });
  }
  return res.status(400).json({ error: result.error || 'Downgrade failed' });
}));

router.post('/cancel', requireJWTFromCookie, validateCSRF, asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { gracePeriodDays } = req.body;
  const result = await cancelSubscription(userId, gracePeriodDays || 7);
  if (result.success) {
    return res.json({ success: true, message: 'Subscription cancelled successfully' });
  }
  return res.status(400).json({ error: result.error || 'Cancellation failed' });
}));

// webhook (raw body required in app.ts, no auth/CSRF needed)
router.post('/webhook', asyncHandler(stripeWebhook));

export default router;



