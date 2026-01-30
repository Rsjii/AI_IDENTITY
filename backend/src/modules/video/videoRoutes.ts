import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import { deleteVideoAvatar, generateVideo, listVideoAvatars, uploadVideoAvatar } from './videoController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/upload', requireJWTFromCookie, validateCSRF, upload.single('video'), asyncHandler(uploadVideoAvatar));
router.get('/list', requireJWTFromCookie, asyncHandler(listVideoAvatars));
router.delete('/:id', requireJWTFromCookie, validateCSRF, asyncHandler(deleteVideoAvatar));
router.post('/generate', requireJWTFromCookie, validateCSRF, asyncHandler(generateVideo));

export default router;

