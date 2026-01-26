import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import {
  connectWhatsApp,
  getWhatsAppStatus,
  disconnectWhatsApp,
  handleWebhook,
} from './whatsappController';

const router = Router();

// ========== AUTHENTICATED ROUTES ==========

// Connect WhatsApp (register phone number)
router.post('/connect', requireJWTFromCookie, validateCSRF, connectWhatsApp);

// Get connection status
router.get('/status', requireJWTFromCookie, getWhatsAppStatus);

// Disconnect WhatsApp
router.post('/disconnect', requireJWTFromCookie, validateCSRF, disconnectWhatsApp);

// ========== PUBLIC WEBHOOK ROUTE ==========

// Webhook handler (POST) - Twilio sends messages here
router.post('/webhook', handleWebhook);

export default router;

