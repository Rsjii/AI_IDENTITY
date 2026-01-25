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
} from './identityController';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { sanitizeInput } from '../../middleware/validation';
import { validateCSRF } from '../../middleware/csrf';
import { draftGenerationRateLimit, identityCreateRateLimit, trustConfirmRateLimit, mirrorDailyRateLimit } from '../../middleware/rateLimit';

const router = Router();

// All routes require authentication
router.use(requireJWTFromCookie);

// Create identity
router.post('/', sanitizeInput, validateCSRF, identityCreateRateLimit, createIdentity);

// Get identity
router.get('/me', getIdentity);

// Create new identity version (immutable) + activate
router.post('/version', sanitizeInput, validateCSRF, createIdentityVersion);

// Activate an existing version
router.post('/version/:id/activate', sanitizeInput, validateCSRF, activateIdentityVersion);

// List all versions
router.get('/versions', listIdentityVersions);

// Update identity version (backward compatible - now creates new version)
router.put('/version/:id', sanitizeInput, validateCSRF, updateIdentityVersion);

// Mirror (generate reply)
router.post('/mirror', sanitizeInput, validateCSRF, draftGenerationRateLimit, mirrorDailyRateLimit, mirror);

// Trust confirmation
router.post('/trust/confirm', sanitizeInput, validateCSRF, trustConfirmRateLimit, confirmTrust);

export default router;

