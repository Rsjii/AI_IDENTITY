import { Router } from 'express';
import {
  createIdentity,
  getIdentity,
  updateIdentityVersion,
  mirror,
  confirmTrust,
  createIdentityVersion,
  activateIdentityVersion,
  listIdentityVersions,
  getTrainingStatus,
  setupIdentity,
} from './identityController';
import { mirrorVoice } from './voiceMirrorController';
import {
  createVariant,
  getVariantGroup,
  getVariantMetrics,
  updateVariantWeight,
  toggleVariantStatus,
  listVariantGroups,
} from './variantController';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { sanitizeInput } from '../../middleware/validation';
import { validateCSRF } from '../../middleware/csrf';
import { authenticatedChatRateLimit, draftGenerationRateLimit, identityCreateRateLimit, trustConfirmRateLimit, mirrorDailyRateLimit } from '../../middleware/rateLimit';

const router = Router();

// All routes require authentication
router.use(requireJWTFromCookie);

// Create identity
router.post('/', sanitizeInput, validateCSRF, identityCreateRateLimit, createIdentity);

// Setup identity (for onboarding start page)
router.post('/setup', sanitizeInput, validateCSRF, identityCreateRateLimit, setupIdentity);

// Get identity
router.get('/me', getIdentity);
router.get('/active', getIdentity);

// Get training status (for onboarding)
router.get('/training-status', getTrainingStatus);

// Create new identity version (immutable) + activate
router.post('/version', sanitizeInput, validateCSRF, createIdentityVersion);

// Activate an existing version
router.post('/version/:id/activate', sanitizeInput, validateCSRF, activateIdentityVersion);

// List all versions
router.get('/versions', listIdentityVersions);

// Update identity version (backward compatible - now creates new version)
router.put('/version/:id', sanitizeInput, validateCSRF, updateIdentityVersion);

// Mirror (generate reply)
router.post('/mirror', sanitizeInput, validateCSRF, authenticatedChatRateLimit, draftGenerationRateLimit, mirrorDailyRateLimit, mirror);

// Mirror with voice (generate reply + audio)
router.post('/mirror-voice', sanitizeInput, validateCSRF, authenticatedChatRateLimit, draftGenerationRateLimit, mirrorDailyRateLimit, mirrorVoice);

// Trust confirmation
router.post('/trust/confirm', sanitizeInput, validateCSRF, trustConfirmRateLimit, confirmTrust);

// A/B Testing Variants (Scale plan only)
router.post('/variants/create', sanitizeInput, validateCSRF, createVariant);
router.get('/variants/list', listVariantGroups);
router.get('/variants/:variantGroupId', getVariantGroup);
router.get('/variants/:variantGroupId/metrics', getVariantMetrics);
router.post('/variants/update-weight', sanitizeInput, validateCSRF, updateVariantWeight);
router.post('/variants/toggle-status', sanitizeInput, validateCSRF, toggleVariantStatus);

export default router;

