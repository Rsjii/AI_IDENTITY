import { Request, Response } from 'express';
import { z } from 'zod';
import { userQueries, stripePaymentQueries, chatMessageQueries, db, premiumSessionQueries } from '../../config/database';
import Stripe from 'stripe';
import { logger } from '../../config/logger';
import { EmailService } from '../auth/authService';
import { generateMirrorReplyWithLogging } from '../identity/identityService';
import { EventLogger } from '../../services/eventLogger';
import { EVENT_TYPES } from '../../config/constants';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  logger.warn('STRIPE_SECRET_KEY not configured');
}
const stripe = stripeSecret ? new Stripe(stripeSecret, {}) : null;

const DEFAULT_PAY_PER_CHAT_TIERS = [100, 500, 1000, 2500, 5000];

function getPayPerChatTiers(priceConfig: any): number[] {
  const raw = Array.isArray(priceConfig?.payPerChatTiers) ? priceConfig.payPerChatTiers : DEFAULT_PAY_PER_CHAT_TIERS;
  const normalized = raw
    .map((v: any) => Number(v))
    .filter((v: number) => Number.isFinite(v) && Number.isInteger(v) && v > 0)
    .filter((v: number, i: number, arr: number[]) => arr.indexOf(v) === i)
    .sort((a: number, b: number) => a - b);
  return normalized.length ? normalized : DEFAULT_PAY_PER_CHAT_TIERS;
}

const createPaymentIntentSchema = z.object({
  creatorId: z.string().min(1),
  amountCents: z.number().int().min(100),
  tierLabel: z.string().min(1).optional(),
  visitorId: z.string().optional(),
  sessionId: z.string().optional(),
  payerEmail: z.string().email().optional(),
});

const confirmPaymentSchema = z.object({
  paymentIntentId: z.string().min(1),
  creatorId: z.string().min(1),
  sessionId: z.string().optional(),
  amountCents: z.number().int().min(100).optional(),
  tierLabel: z.string().optional(),
});

export async function createPaymentIntent(req: Request, res: Response) {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
    }
    const { creatorId, amountCents, tierLabel, visitorId, sessionId, payerEmail } = createPaymentIntentSchema.parse(req.body);

    const creator = await userQueries.findById(creatorId);
    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const tiers = getPayPerChatTiers(creator.priceConfig);
    if (!tiers.includes(amountCents)) {
      return res.status(400).json({ error: 'Invalid tier amount' });
    }

    const resolvedTierLabel = tierLabel || `$${(amountCents / 100).toFixed(2)}`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: {
        creatorId,
        tierAmountCents: String(amountCents),
        tierLabel: resolvedTierLabel,
        visitorId: visitorId || '',
        sessionId: sessionId || '',
        payerEmail: payerEmail || '',
      },
      receipt_email: payerEmail || undefined,
    });

    return res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    logger.error({ error }, 'Payment intent error');
    return res.status(400).json({ error: error.message || 'Failed to create payment intent' });
  }
}

export async function confirmPayment(req: Request, res: Response) {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
    }
    const { paymentIntentId, creatorId, sessionId, amountCents } = confirmPaymentSchema.parse(req.body);

    // Verify payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // ✅ Validate metadata to prevent spoofing (source of truth = Stripe)
    const metaCreatorId = paymentIntent.metadata?.creatorId || '';
    const metaSessionId = paymentIntent.metadata?.sessionId || '';
    const metaTierAmount = Number(paymentIntent.metadata?.tierAmountCents || 0);

    if (metaCreatorId && metaCreatorId !== creatorId) {
      return res.status(400).json({ error: 'Creator mismatch' });
    }
    if (metaSessionId && sessionId && metaSessionId !== sessionId) {
      return res.status(400).json({ error: 'Session mismatch' });
    }
    if (amountCents && amountCents !== paymentIntent.amount) {
      return res.status(400).json({ error: 'Amount mismatch' });
    }
    if (amountCents && metaTierAmount && amountCents !== metaTierAmount) {
      return res.status(400).json({ error: 'Tier amount mismatch' });
    }

    // ✅ Idempotency: avoid duplicate records
    const existing = await db.query(
      `SELECT id FROM "stripe_payments" WHERE "stripePaymentIntentId"=$1 LIMIT 1`,
      [paymentIntentId]
    );
    if (existing.rows[0]) {
      return res.json({ success: true, reply: '' });
    }

    // ✅ Trust Stripe amount, not client
    const amount = paymentIntent.amount;

    // Calculate platform fee (25%)
    const PLATFORM_FEE_PERCENT = 0.25;
    const platformFee = Math.floor(amount * PLATFORM_FEE_PERCENT);
    const creatorEarnings = amount - platformFee;

    // Get payer identity (important for spending stats)
    const payerUserId = (req as any).user?.id || null;
    const payerVisitorId = paymentIntent.metadata?.visitorId || null;

    // Record payment
    const payment = await stripePaymentQueries.create({
      creatorId: metaCreatorId || creatorId,
      payerUserId,
      payerVisitorId,
      sessionId: metaSessionId || sessionId || null,
      amount,
      status: 'succeeded',
      stripePaymentIntentId: paymentIntentId,
      platformFeeCents: platformFee,
      creatorEarningsCents: creatorEarnings,
      type: 'pay_per_chat',
    });

    // ✅ Create premium session window (24 hours)
    if (metaSessionId || sessionId) {
      const resolvedSessionId = metaSessionId || sessionId || '';
      if (resolvedSessionId) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await premiumSessionQueries.create({
          creatorId: metaCreatorId || creatorId,
          sessionId: resolvedSessionId,
          stripePaymentId: paymentIntentId,
          expiresAt,
        });
      }
    }

    // ✅ Log PAYMENT_COMPLETED event
    EventLogger.logSystemEvent(EVENT_TYPES.PAYMENT_COMPLETED, {
      creatorId,
      sessionId: sessionId || null,
      visitorId: paymentIntent.metadata?.visitorId || null,
      amountCents: amount,
      tierAmountCents: metaTierAmount || amount,
      tierLabel: paymentIntent.metadata?.tierLabel || null,
      platformFeeCents: platformFee,
      creatorEarningsCents: creatorEarnings,
      paymentIntentId,
    }).catch((err) => {
      logger.warn('Failed to log PAYMENT_COMPLETED event:', err);
    });

    // Get payer email from payment intent metadata
    const payerEmail = paymentIntent.metadata?.payerEmail;
    const visitorId = paymentIntent.metadata?.visitorId;

    // Get the last user message from the session to regenerate reply
    let fullReply = '';
    if (metaSessionId || sessionId) {
      try {
        // Get the last user message
        const resolvedSessionId = metaSessionId || sessionId || '';
        const messages = await chatMessageQueries.listForSession(resolvedSessionId);
        const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
        
        if (lastUserMessage) {
          // Regenerate full reply after payment
          const resolvedCreatorId = metaCreatorId || creatorId;
          const creator = await userQueries.findById(resolvedCreatorId);
          if (creator) {
            const result = await generateMirrorReplyWithLogging(resolvedCreatorId, 'public_chat', lastUserMessage.content, {
              platform: 'web',
              sessionId: resolvedSessionId,
              visitorId,
            });
            fullReply = result.reply || '';
            
            // Save the full reply if not already saved
            if (fullReply) {
              await chatMessageQueries.add({ sessionId: resolvedSessionId, role: 'assistant', content: fullReply });
            }
          }
        }
      } catch (err: any) {
        logger.error('[Payment] Error generating reply after payment:', err);
      }
    }

    // Send receipt email and full answer
    if (payerEmail) {
      try {
        const emailService = new EmailService();
        const creator = await userQueries.findById(creatorId);
        const creatorName = creator?.name || creator?.handle || 'Creator';
        
        // Send receipt + full answer email
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #2563eb;">Payment Receipt</h2>
              <p>Thank you for your payment!</p>
              
              <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Amount Paid:</strong> $${(amount / 100).toFixed(2)}</p>
                <p><strong>Creator:</strong> ${creatorName}</p>
                <p><strong>Payment ID:</strong> ${paymentIntentId}</p>
              </div>

              ${fullReply ? `
                <h3 style="color: #2563eb; margin-top: 30px;">Your Full Answer:</h3>
                <div style="background: #fff; padding: 20px; border-left: 4px solid #2563eb; margin: 20px 0;">
                  ${fullReply.split('\n').map((p: string) => `<p>${p}</p>`).join('')}
                </div>
              ` : ''}

              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                This is your receipt for the payment. Keep this email for your records.
              </p>
            </div>
          </body>
          </html>
        `;

        // ✅ Send receipt email with full answer
        const emailSent = await emailService.sendEmail(
          payerEmail, 
          'Payment Receipt - Your Full Answer', 
          emailHtml
        );
        
        if (emailSent) {
          logger.info(`✅ [Payment] Receipt email sent successfully to ${payerEmail}`);
        } else {
          logger.warn(`⚠️ [Payment] Failed to send receipt email to ${payerEmail}`);
        }
      } catch (err: any) {
        logger.error('[Payment] Error sending receipt email:', err);
      }
    }

    return res.json({ success: true, reply: fullReply });
  } catch (error: any) {
    logger.error({ error }, 'Confirm payment error');
    return res.status(400).json({ error: error.message || 'Failed to confirm payment' });
  }
}