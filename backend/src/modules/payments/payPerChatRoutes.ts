import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { createPaymentIntent, confirmPayment } from './payPerChatController';

const router = Router();

// ✅ Public visitors can pay, so no JWT required
router.post('/intent', asyncHandler(createPaymentIntent));
router.post('/confirm', asyncHandler(confirmPayment));

export default router;

