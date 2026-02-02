import { Router } from 'express';
import multer from 'multer';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import { sanitizeInput } from '../../middleware/validation';
import { enhancedSanitize } from '../../middleware/sanitizer';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  paste,
  youtube,
  url,
  upload,
  list,
  remove,
  importYoutubeChannel,
  importTwitterHandle,
} from './contentController';

import twitterAuthRoutes from './twitterAuthRoutes';
import youtubeAuthRoutes from './youtubeAuthRoutes';
import instagramAuthRoutes from './instagramAuthRoutes';
import linkedinAuthRoutes from './linkedinAuthRoutes';


const router = Router();
const uploadMem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

/**
 * ✅ OAuth routes MUST be reachable without JWT cookie (callback redirects from external sites).
 * So mount them before router.use(requireJWTFromCookie).
 */
router.use('/social/twitter', twitterAuthRoutes);
router.use('/social/youtube', youtubeAuthRoutes);
router.use('/social/instagram', instagramAuthRoutes);
router.use('/social/linkedin', linkedinAuthRoutes);

/**
 * Everything below requires login
 */
router.use(requireJWTFromCookie);

router.get('/list', asyncHandler(list));

router.post('/paste', enhancedSanitize(), sanitizeInput, validateCSRF, asyncHandler(paste));
router.post('/youtube', enhancedSanitize(), sanitizeInput, validateCSRF, asyncHandler(youtube));
router.post('/url', enhancedSanitize(), sanitizeInput, validateCSRF, asyncHandler(url));

// ✅ Multer must come BEFORE validateCSRF (multer parses FormData first)
router.post('/upload', uploadMem.single('file'), validateCSRF, asyncHandler(upload));
router.delete('/:id', sanitizeInput, validateCSRF, asyncHandler(remove));

// "URL based" social imports (no OAuth)
router.post('/social/youtube-channel', sanitizeInput, validateCSRF, asyncHandler(importYoutubeChannel));
router.post('/social/twitter', sanitizeInput, validateCSRF, asyncHandler(importTwitterHandle));

export default router;