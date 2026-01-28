import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { getCreator, publicChat, publicFeedback } from './publicController';
import { submitContactForm } from './contactController';
import { contactFormRateLimit, contactFormDailyLimit } from '../../middleware/rateLimit';

const router = Router();

router.get('/creator/:slug', asyncHandler(getCreator));
router.post('/chat', asyncHandler(publicChat));
router.post('/feedback', asyncHandler(publicFeedback));
router.post('/contact', contactFormRateLimit, contactFormDailyLimit, asyncHandler(submitContactForm));

export default router;