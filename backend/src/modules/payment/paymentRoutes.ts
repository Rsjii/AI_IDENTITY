import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { asyncHandler } from '../../middleware/errorHandler';
import { createPaymentOrder, verifyPayment, getMySubscription, cancelSubscription } from './paymentController';

const router = Router();

router.use(requireJWTFromCookie);

router.post('/create-order', asyncHandler(createPaymentOrder));
router.post('/verify', asyncHandler(verifyPayment));
router.get('/subscription', asyncHandler(getMySubscription));
router.post('/cancel', asyncHandler(cancelSubscription));

export default router;

