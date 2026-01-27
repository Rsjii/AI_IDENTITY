import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { getCreator, publicChat, publicFeedback } from './publicController';

const router = Router();

router.get('/creator/:slug', asyncHandler(getCreator));
router.post('/chat', asyncHandler(publicChat));
router.post('/feedback', asyncHandler(publicFeedback));

export default router;