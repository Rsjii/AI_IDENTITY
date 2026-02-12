/**
 * Token Pack Routes
 * API endpoints for token pack purchases
 */

import express from 'express';
import {
  getAvailablePacks,
  createPackCheckout,
  verifyPackPayment,
  getPackBalance,
} from './tokenPackController';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';

const router = express.Router();

/**
 * GET /api/marketplace/token-packs/:creatorId
 * Get available token packs for a creator
 * No auth required (can be called by guests)
 */
router.get('/token-packs/:creatorId', getAvailablePacks);

/**
 * POST /api/marketplace/token-packs/checkout
 * Create checkout session for token pack purchase
 * Requires auth and CSRF protection
 */
router.post('/token-packs/checkout', requireJWTFromCookie, validateCSRF, createPackCheckout);

/**
 * POST /api/marketplace/token-packs/verify
 * Verify Razorpay payment for token pack
 * Requires auth and CSRF protection
 */
router.post('/token-packs/verify', requireJWTFromCookie, validateCSRF, verifyPackPayment);

/**
 * GET /api/marketplace/token-packs/balance
 * Get user's token pack balance with a creator
 * Requires auth
 */
router.get('/token-packs/balance', requireJWTFromCookie, getPackBalance);

export default router;
