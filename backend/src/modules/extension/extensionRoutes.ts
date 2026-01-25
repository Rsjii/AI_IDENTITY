import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import { sanitizeInput } from '../../middleware/validation';
import { createToken, listTokens, revokeToken } from './extensionController';

const router = Router();
router.use(requireJWTFromCookie);

router.post('/token', sanitizeInput, validateCSRF, createToken);
router.get('/tokens', listTokens);
router.delete('/token/:id', sanitizeInput, validateCSRF, revokeToken);

export default router;


