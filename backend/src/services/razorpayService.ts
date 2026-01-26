import Razorpay from 'razorpay';
import { logger } from '../config/logger';
import { isFeatureEnabled } from '../config/featureFlags';

let client: Razorpay | null = null;

export function initializeRazorpay(): void {
  if (!isFeatureEnabled('ENABLE_PAYMENTS')) {
    logger.info('Payments disabled via feature flag (ENABLE_PAYMENTS).');
    client = null;
    return;
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    logger.warn('Razorpay keys missing. Payments disabled.');
    client = null;
    return;
  }

  client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  logger.info('Razorpay initialized.');
}

export function getRazorpayClient(): Razorpay {
  if (!client) throw new Error('Razorpay not initialized');
  return client;
}

export async function createOrder(params: {
  amount: number; // paise
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string }> {
  const rp = getRazorpayClient();
  const order = await rp.orders.create({
    amount: params.amount,
    currency: params.currency || 'INR',
    receipt: params.receipt || `rcpt_${Date.now()}`,
    notes: params.notes || {},
  });

  return { id: order.id, amount: order.amount, currency: order.currency };
}

export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const crypto = require('crypto');
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const payload = `${params.orderId}|${params.paymentId}`;
  const expected = crypto.createHmac('sha256', keySecret).update(payload).digest('hex');
  return expected === params.signature;
}

