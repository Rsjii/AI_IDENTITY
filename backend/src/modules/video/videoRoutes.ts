import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import { checkStorageQuota } from '../../middleware/storageQuota';
import { deleteVideoAvatar, generateVideo, listVideoAvatars, uploadVideoAvatar } from './videoController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/upload', requireJWTFromCookie, upload.single('video'), checkStorageQuota, validateCSRF, asyncHandler(uploadVideoAvatar));
router.get('/list', requireJWTFromCookie, asyncHandler(listVideoAvatars));
router.delete('/:id', requireJWTFromCookie, validateCSRF, asyncHandler(deleteVideoAvatar));
router.post('/generate', requireJWTFromCookie, validateCSRF, asyncHandler(generateVideo));

export default router;

