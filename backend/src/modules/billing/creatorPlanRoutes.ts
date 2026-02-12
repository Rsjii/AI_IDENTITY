/**
 * Creator Plan Routes
 * API endpoints for managing creator subscription plans
 */

import express from 'express';
import {
  getCurrentPlan,
  getPlanUsage,
  createPlanCheckout,
  verifyPlanPayment,
  cancelPlan,
} from './creatorPlanController';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';

const router = express.Router();

// All routes require authentication
router.use(requireJWTFromCookie);

/**
 * GET /api/billing/creator-plan
 * Get current plan details
 */
router.get('/creator-plan', getCurrentPlan);

/**
 * GET /api/billing/creator-plan/usage
 * Get usage statistics
 */
router.get('/creator-plan/usage', getPlanUsage);

/**
 * POST /api/billing/creator-plan/checkout
 * Create checkout session for plan upgrade
 * CSRF protected
 */
router.post('/creator-plan/checkout', validateCSRF, createPlanCheckout);

/**
 * POST /api/billing/creator-plan/verify
 * Verify Razorpay payment
 * CSRF protected
 */
router.post('/creator-plan/verify', validateCSRF, verifyPlanPayment);

/**
 * POST /api/billing/creator-plan/cancel
 * Cancel current plan
 * CSRF protected
 */
router.post('/creator-plan/cancel', validateCSRF, cancelPlan);

export default router;
