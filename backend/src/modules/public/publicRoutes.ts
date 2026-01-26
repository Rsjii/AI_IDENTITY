import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { getCreator, publicChat } from './publicController';

const router = Router();

router.get('/creator/:slug', asyncHandler(getCreator));
router.post('/chat', asyncHandler(publicChat));

export default router;