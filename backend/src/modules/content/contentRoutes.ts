import { Router } from 'express';
import multer from 'multer';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import { sanitizeInput } from '../../middleware/validation';
import { asyncHandler } from '../../middleware/errorHandler';
import { paste, youtube, upload, list, remove, importYoutubeChannel, importTwitterHandle } from './contentController';

const router = Router();
const uploadMem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(requireJWTFromCookie);

router.get('/list', asyncHandler(list));

router.post('/paste', sanitizeInput, validateCSRF, asyncHandler(paste));
router.post('/youtube', sanitizeInput, validateCSRF, asyncHandler(youtube));
router.post('/upload', validateCSRF, uploadMem.single('file'), asyncHandler(upload));
router.delete('/:id', sanitizeInput, validateCSRF, asyncHandler(remove));

// Social import stubs
router.post('/social/youtube-channel', sanitizeInput, validateCSRF, asyncHandler(importYoutubeChannel));
router.post('/social/twitter', sanitizeInput, validateCSRF, asyncHandler(importTwitterHandle));

export default router;