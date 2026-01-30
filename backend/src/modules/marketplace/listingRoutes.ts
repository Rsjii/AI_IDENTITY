import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import { sanitizeInput } from '../../middleware/validation';
import { getListingBySlug, getMyListing, getPublicListings, upsertListing } from './listingController';

const router = Router();

router.get('/listings', asyncHandler(getPublicListings));
router.get('/listings/:slug', asyncHandler(getListingBySlug));

router.get('/my-listing', requireJWTFromCookie, asyncHandler(getMyListing));
router.post('/listings', requireJWTFromCookie, validateCSRF, sanitizeInput, asyncHandler(upsertListing));

export default router;

