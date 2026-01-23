import { Router } from 'express';
import {
  createIdentity,
  getIdentity,
  updateIdentityVersion,
  mirror,
  confirmTrust,
} from './identityController';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { sanitizeInput } from '../../middleware/validation';
import { validateCSRF } from '../../middleware/csrf';
import { draftGenerationRateLimit } from '../../middleware/rateLimit';

const router = Router();

// All routes require authentication
router.use(requireJWTFromCookie);

// Create identity
router.post('/', sanitizeInput, validateCSRF, createIdentity);

// Get identity
router.get('/me', getIdentity);

// Update identity version
router.put('/version/:id', sanitizeInput, validateCSRF, updateIdentityVersion);

// Mirror (generate reply)
router.post('/mirror', sanitizeInput, validateCSRF, draftGenerationRateLimit, mirror);

// Trust confirmation
router.post('/trust/confirm', sanitizeInput, validateCSRF, confirmTrust);

export default router;

