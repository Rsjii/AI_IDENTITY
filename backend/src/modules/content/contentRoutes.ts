import { Router } from 'express';
import multer from 'multer';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import { sanitizeInput } from '../../middleware/validation';
import { enhancedSanitize } from '../../middleware/sanitizer';
import { asyncHandler } from '../../middleware/errorHandler';
import { paste, youtube, upload, list, remove, importYoutubeChannel, importTwitterHandle } from './contentController';
import twitterAuthRoutes from './twitterAuthRoutes';

const router = Router();
const uploadMem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(requireJWTFromCookie);

router.get('/list', asyncHandler(list));

router.post('/paste', enhancedSanitize(), sanitizeInput, validateCSRF, asyncHandler(paste));
router.post('/youtube', enhancedSanitize(), sanitizeInput, validateCSRF, asyncHandler(youtube));
// ✅ Multer must come BEFORE validateCSRF (multer parses FormData first)
router.post('/upload', uploadMem.single('file'), validateCSRF, asyncHandler(upload));
router.delete('/:id', sanitizeInput, validateCSRF, asyncHandler(remove));

// Social import stubs
router.post('/social/youtube-channel', sanitizeInput, validateCSRF, asyncHandler(importYoutubeChannel));
router.post('/social/twitter', sanitizeInput, validateCSRF, asyncHandler(importTwitterHandle));
// ✅ Twitter OAuth routes
router.use('/social/twitter', twitterAuthRoutes);

export default router;