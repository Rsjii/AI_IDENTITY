import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import {
  connectInstagram,
  getInstagramStatus,
  disconnectInstagram,
  verifyWebhook,
  handleWebhook,
} from './instagramController';

const router = Router();

// ========== AUTHENTICATED ROUTES ==========

// Connect Instagram (OAuth callback with token)
router.post('/connect', requireJWTFromCookie, validateCSRF, connectInstagram);

// Get connection status
router.get('/status', requireJWTFromCookie, getInstagramStatus);

// Disconnect Instagram
router.post('/disconnect', requireJWTFromCookie, validateCSRF, disconnectInstagram);

// ========== PUBLIC WEBHOOK ROUTES ==========

// Webhook verification (GET) - Meta sends this to verify webhook
router.get('/webhook', verifyWebhook);

// Webhook handler (POST) - Meta sends messages here
router.post('/webhook', handleWebhook);

export default router;
