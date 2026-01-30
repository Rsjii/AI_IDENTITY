import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import { sanitizeInput } from '../../middleware/validation';
import { connectPhone, disconnectPhone, handlePhoneMessage, phoneStatus, phoneWebhook } from './phoneController';

const router = Router();

router.post('/connect', requireJWTFromCookie, validateCSRF, sanitizeInput, asyncHandler(connectPhone));
router.get('/status', requireJWTFromCookie, asyncHandler(phoneStatus));
router.post('/disconnect', requireJWTFromCookie, validateCSRF, asyncHandler(disconnectPhone));

// Public webhook (Twilio Voice)
router.post('/webhook', asyncHandler(phoneWebhook));

// Optional text bridge (for testing)
router.post('/message', sanitizeInput, asyncHandler(handlePhoneMessage));

export default router;

