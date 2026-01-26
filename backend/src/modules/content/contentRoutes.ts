import { Router } from 'express';
import multer from 'multer';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import { sanitizeInput } from '../../middleware/validation';
import { asyncHandler } from '../../middleware/errorHandler';
import { paste, youtube, upload, list, remove } from './contentController';

const router = Router();
const uploadMem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(requireJWTFromCookie);

router.get('/list', asyncHandler(list));

router.post('/paste', sanitizeInput, validateCSRF, asyncHandler(paste));
router.post('/youtube', sanitizeInput, validateCSRF, asyncHandler(youtube));
router.post('/upload', validateCSRF, uploadMem.single('file'), asyncHandler(upload));
router.delete('/:id', sanitizeInput, validateCSRF, asyncHandler(remove));

export default router;