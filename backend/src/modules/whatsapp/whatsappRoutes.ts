import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import {
  connectWhatsApp,
  getWhatsAppStatus,
  getWhatsAppStats,
  disconnectWhatsApp,
  updateWhatsAppSettings,
  handleWebhook,
} from './whatsappController';

const router = Router();

// ========== AUTHENTICATED ROUTES ==========

// Connect WhatsApp (register phone number)
router.post('/connect', requireJWTFromCookie, validateCSRF, connectWhatsApp);

// Get connection status
router.get('/status', requireJWTFromCookie, getWhatsAppStatus);

// Basic stats
router.get('/stats', requireJWTFromCookie, getWhatsAppStats);

// Disconnect WhatsApp
router.post('/disconnect', requireJWTFromCookie, validateCSRF, disconnectWhatsApp);

// Update WhatsApp settings
router.post('/settings', requireJWTFromCookie, validateCSRF, updateWhatsAppSettings);

// ========== PUBLIC WEBHOOK ROUTE ==========

// Webhook handler (POST) - Twilio sends messages here
router.post('/webhook', handleWebhook);

export default router;





