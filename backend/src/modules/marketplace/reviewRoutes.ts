import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import { sanitizeInput } from '../../middleware/validation';
import { createReview, listReviews } from './reviewController';

const router = Router();

router.get('/reviews/:listingId', asyncHandler(listReviews));
router.post('/reviews', requireJWTFromCookie, validateCSRF, sanitizeInput, asyncHandler(createReview));

export default router;

