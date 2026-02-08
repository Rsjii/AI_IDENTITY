import { Request, Response } from 'express';

export async function createPaymentIntent(_req: Request, res: Response) {
  return res.status(501).json({
    error: 'Pay-per-chat is disabled (Stripe removed).',
    errorCode: 'PAY_PER_CHAT_DISABLED',
  });
}

export async function confirmPayment(_req: Request, res: Response) {
  return res.status(501).json({
    error: 'Pay-per-chat is disabled (Stripe removed).',
    errorCode: 'PAY_PER_CHAT_DISABLED',
  });
}
