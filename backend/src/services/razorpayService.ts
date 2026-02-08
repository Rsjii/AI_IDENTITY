import Razorpay from 'razorpay';
import { logger } from '../config/logger';
import { isFeatureEnabled } from '../config/featureFlags';

let client: Razorpay | null = null;

export function initializeRazorpay(): void {
  logger.info('[RAZORPAY-INIT] Starting Razorpay initialization...');
  
  if (!isFeatureEnabled('ENABLE_PAYMENTS')) {
    logger.info('[RAZORPAY-INIT] Payments disabled via feature flag (ENABLE_PAYMENTS).');
    client = null;
    return;
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  logger.info({
    keyIdExists: !!keyId,
    keyIdLength: keyId?.length || 0,
    keyIdPrefix: keyId?.substring(0, 10) || 'N/A',
    keySecretExists: !!keySecret,
    keySecretLength: keySecret?.length || 0,
  }, '[RAZORPAY-INIT] Environment check:');

  if (!keyId || !keySecret) {
    logger.warn({
      keyIdPresent: !!keyId,
      keySecretPresent: !!keySecret,
    }, '[RAZORPAY-INIT] ❌ Razorpay keys missing. Payments disabled.');
    client = null;
    return;
  }

  // Check for common issues
  if (!keyId.startsWith('rzp_test_') && !keyId.startsWith('rzp_live_')) {
    logger.warn('[RAZORPAY-INIT] ⚠️ Key ID does not start with rzp_test_ or rzp_live_');
  }
  
  if (keyId.includes(' ') || keySecret.includes(' ')) {
    logger.warn('[RAZORPAY-INIT] ⚠️ Keys may contain spaces - this can cause authentication failures');
  }

  try {
    client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    logger.info('[RAZORPAY-INIT] ✅ Razorpay initialized successfully');
    logger.info({
      keyIdPrefix: keyId.substring(0, 10) + '...',
      keyIdLength: keyId.length,
    }, '[RAZORPAY-INIT] Key ID info:');
  } catch (error: any) {
    logger.error({
      error: error.message,
      stack: error.stack?.substring(0, 300),
    }, '[RAZORPAY-INIT] ❌ Failed to initialize Razorpay client:');
    client = null;
  }
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
  
  logger.info({
    amount: params.amount,
    currency: params.currency || 'INR',
    receipt: params.receipt || `rcpt_${Date.now()}`,
    notes: params.notes || {},
  }, '[RAZORPAY] Creating order with params:');
  
  // Log key info (first 10 chars only for security)
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  logger.info({
    keyIdPrefix: keyId.substring(0, 10) + '...',
    keyIdLength: keyId.length,
    keySecretLength: (process.env.RAZORPAY_KEY_SECRET || '').length,
  }, '[RAZORPAY] Using credentials:');
  
  try {
    const order = await rp.orders.create({
      amount: params.amount,
      currency: params.currency || 'INR',
      receipt: params.receipt || `rcpt_${Date.now()}`,
      notes: params.notes || {},
    });
    
    logger.info({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
    }, '[RAZORPAY] ✅ Order created successfully:');
    
    return { 
      id: order.id, 
      amount: typeof order.amount === 'number' ? order.amount : Number(order.amount), 
      currency: order.currency 
    };
  } catch (error: any) {
    // Detailed error logging
    const errorDetails: any = {
      message: error.message || 'Unknown error',
      statusCode: error.statusCode,
    };
    
    if (error.error) {
      errorDetails.errorCode = error.error.code;
      errorDetails.errorDescription = error.error.description;
      errorDetails.errorField = error.error.field;
      errorDetails.errorSource = error.error.source;
      errorDetails.errorStep = error.error.step;
      errorDetails.errorReason = error.error.reason;
      errorDetails.errorMetadata = error.error.metadata;
    }
    
    if (error.statusCode === 401) {
      errorDetails.hint = 'Authentication failed - Check: 1) Keys are correct, 2) Keys are from same account, 3) Keys are test keys (rzp_test_...), 4) Account is active';
    }
    
    logger.error(errorDetails, '[RAZORPAY] ❌ Order creation failed:');
    logger.error({
      name: error.name,
      stack: error.stack?.substring(0, 500), // First 500 chars of stack
    }, '[RAZORPAY] Full error object:');
    
    throw error;
  }
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

