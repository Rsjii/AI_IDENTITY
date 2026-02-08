// Stripe removed - this file is stubbed out for backward compatibility
// These routes are not mounted in app.ts (Stripe has been replaced with Razorpay/LemonSqueezy)

import { Request, Response } from 'express';

export async function createCheckoutSession(_req: Request, res: Response) {
  return res.status(501).json({ error: 'Stripe checkout is disabled. Use Razorpay (India) or LemonSqueezy (International) instead.' });
}

export async function stripeWebhook(_req: Request, res: Response) {
  return res.status(501).json({ error: 'Stripe webhook is disabled.' });
}
