[22 tools called]

Below are the **exact code changes**, file‑wise. Apply as noted. Code blocks have **no file paths** (per ask‑mode rules).

---

##1 `backend/src/modules/payments/payPerChatController.ts` (replace full file)
```ts
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

    // Record payment
    const payment = await stripePaymentQueries.create({
      creatorId: metaCreatorId || creatorId,
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
```

---

##2 `backend/src/modules/creator/creatorController.ts` (replace pricing block + `setPricing`)
Replace the **pricing constants + schema + setPricing** block with this:

```ts
const DEFAULT_PAY_PER_CHAT_TIERS = [100, 500, 1000, 2500, 5000];
const MIN_TIER_CENTS = 100;
const MAX_TIER_CENTS = 10000;

const tierAmountSchema = z.number().int().min(MIN_TIER_CENTS).max(MAX_TIER_CENTS);

const pricingSchema = z.object({
  free: z.object({ enabled: z.boolean().default(true) }).passthrough().optional(),
  payPerChatTiers: z.array(tierAmountSchema).min(1).max(10).optional(),
  defaultTierCents: tierAmountSchema.optional(),
  premium: z.object({
    enabled: z.boolean().default(true),
    amountCents: tierAmountSchema,
  }).passthrough().optional(),
  vip: z.object({
    enabled: z.boolean().default(true),
    amountCents: tierAmountSchema,
  }).passthrough().optional(),
}).passthrough().superRefine((cfg, ctx) => {
  if (cfg.defaultTierCents && cfg.payPerChatTiers && !cfg.payPerChatTiers.includes(cfg.defaultTierCents)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'defaultTierCents must exist in payPerChatTiers',
      path: ['defaultTierCents'],
    });
  }
});

function normalizeTierList(tiers: number[] | undefined, fallback: number[]) {
  const base = Array.isArray(tiers) ? tiers : fallback;
  const normalized = base
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && Number.isInteger(v) && v >= MIN_TIER_CENTS && v <= MAX_TIER_CENTS)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort((a, b) => a - b);
  return normalized.length ? normalized : fallback;
}

export async function setPricing(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const cfg = pricingSchema.parse(req.body);

  const payPerChatTiers = normalizeTierList(cfg.payPerChatTiers, DEFAULT_PAY_PER_CHAT_TIERS);
  const defaultTierCents = cfg.defaultTierCents && payPerChatTiers.includes(cfg.defaultTierCents)
    ? cfg.defaultTierCents
    : payPerChatTiers[0];

  // Backward compatible premium/vip for any legacy consumers
  const premiumAmount = cfg.premium?.amountCents || payPerChatTiers[0];
  const vipAmount = cfg.vip?.amountCents || payPerChatTiers[payPerChatTiers.length - 1];

  const nextConfig = {
    ...cfg,
    payPerChatTiers,
    defaultTierCents,
    premium: { enabled: cfg.premium?.enabled ?? true, amountCents: premiumAmount },
    vip: { enabled: cfg.vip?.enabled ?? true, amountCents: vipAmount },
  };

  const u = await userQueries.updatePricing(userId, nextConfig);
  return res.json({ success: true, priceConfig: u.priceConfig });
}
```

---

##3 `backend/src/services/stripeService.ts` (replace full file)
```ts
import Stripe from 'stripe';

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY missing');
    stripe = new Stripe(key, { apiVersion: '2023-10-16' });
  }
  return stripe;
}

export function mustGetStripeWebhookSecret(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s) throw new Error('STRIPE_WEBHOOK_SECRET missing');
  return s;
}

export function getStripePriceId(tier: 'starter' | 'growth' | 'scale'): string {
  const map = {
    starter: process.env.STRIPE_PRICE_STARTER,
    growth: process.env.STRIPE_PRICE_GROWTH,
    scale: process.env.STRIPE_PRICE_SCALE,
  };
  const v = map[tier];
  if (!v) throw new Error(`Stripe price id missing for tier=${tier}`);
  return v;
}

export async function createWhatsAppPaymentLink(params: {
  amountCents: number;
  creatorId: string;
  visitorId?: string | null;
  sessionId?: string | null;
  tierLabel?: string;
  returnUrl?: string;
}) {
  const stripeClient = getStripe();

  const label = params.tierLabel || `$${(params.amountCents / 100).toFixed(2)}`;
  const returnUrl = params.returnUrl || (process.env.FRONTEND_URL || 'https://selflyx.com');

  const link = await stripeClient.paymentLinks.create({
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: params.amountCents,
          product_data: {
            name: `Pay-per-chat (${label})`,
          },
        },
        quantity: 1,
      },
    ],
    after_completion: {
      type: 'redirect',
      redirect: { url: returnUrl },
    },
    metadata: {
      creatorId: params.creatorId,
      visitorId: params.visitorId || '',
      sessionId: params.sessionId || '',
      tierAmountCents: String(params.amountCents),
      tierLabel: label,
      platform: 'whatsapp',
    },
  });

  return link.url;
}
```

---

##4 `backend/src/modules/whatsapp/whatsappController.ts` (add helper + update paywall section)

### 1) Add import
```ts
import { createWhatsAppPaymentLink } from '../../services/stripeService';
```

### 2) Add helper near top (after `getUserId`)
```ts
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
```

### 3) Replace paywall block inside `handleWebhook`
Replace this block:
```ts
      if (decision.requiresPayment) {
        const slug = user.publicSlug || user.handle || '';
        const paymentLink = slug ? `${process.env.FRONTEND_URL || 'https://selflyx.com'}/chat/${slug}?upgrade=1` : '';
        const teaser = `This is a premium request. ${paymentLink ? `Pay here: ${paymentLink}` : 'Please visit the chat link to unlock.'}`;
        await sendWhatsAppMessage(fromNumber, teaser);
        await whatsappConversationQueries.upsert(userId, fromNumber, {
          ...convoData,
          recentMessages: updatedMessages,
          hourlyCount,
          hourlyResetAt: now + 60 * 60 * 1000,
        });
        return res.status(200).send('<Response></Response>');
      }
```

with this:
```ts
      if (decision.requiresPayment) {
        const tiers = getPayPerChatTiers(user.priceConfig);
        const preferred = Number((user.priceConfig as any)?.defaultTierCents || 0);
        const amountCents = tiers.includes(preferred) ? preferred : tiers[0];

        let paymentLink = '';
        try {
          paymentLink = await createWhatsAppPaymentLink({
            amountCents,
            creatorId: userId,
            visitorId: fromNumber,
            tierLabel: `$${(amountCents / 100).toFixed(2)}`,
          });
        } catch (err: any) {
          logger.error('[WhatsApp] Failed to create payment link:', err);
        }

        const teaser = `This is a premium request. ${
          paymentLink ? `Pay here: ${paymentLink}` : 'Please visit your chat link to unlock.'
        }`;

        await sendWhatsAppMessage(fromNumber, teaser);
        await whatsappConversationQueries.upsert(userId, fromNumber, {
          ...convoData,
          recentMessages: updatedMessages,
          hourlyCount,
          hourlyResetAt: now + 60 * 60 * 1000,
          pendingPayment: {
            amountCents,
            paymentLink: paymentLink || null,
            createdAt: new Date().toISOString(),
          },
        });
        return res.status(200).send('<Response></Response>');
      }
```

---

##5 `backend/src/modules/public/publicController.ts` (update paywall response)

Add this helper near top of file (once):
```ts
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
```

Then replace the paywall response section (currently using `premium/vip`) with:
```ts
      const pricing = u.priceConfig || {};
      const tiers = getPayPerChatTiers(pricing);
      const preferred = Number((pricing as any)?.defaultTierCents || 0);
      const defaultAmount = tiers.includes(preferred) ? preferred : tiers[0];

      return res.json({
        success: true,
        requiresPayment: true,
        sessionId: sid,
        creatorId: u.id,
        paymentOptions: {
          tiers: tiers.map((amount) => ({
            amount,
            label: `$${(amount / 100).toFixed(2)}`,
          })),
          defaultAmount,
        },
        previewReply,
      });
```

---

##6 `backend/src/modules/profile/profileController.ts` (replace full file)
```ts
import { Request, Response } from 'express';
import { userQueries } from '../../config/database';
import { logger } from '../../config/logger';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { db } from '../../config/database';
import JSZip from 'jszip';
import { EmailService, generateOTP, hashOTP, verifyOTP } from '../auth/authService';
import { otpQueries } from '../../config/database';

function getUserId(req: Request): string | null {
  const u: any = (req as any).user;
  return u?.id || u?.userId || null;
}

export const updateProfile = async (req: Request, res: Response) => {
  try {
    // Check if user is logged in via JWT
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // ✅ FIX: Handle file upload if present
    let profileImagePath = undefined;
    
    // ✅ FIX: Use ENV-driven uploads root (prod persistent volume support)
    const uploadsRoot = process.env.UPLOADS_DIR
      ? path.resolve(process.env.UPLOADS_DIR)
      : path.resolve(process.cwd(), 'public/uploads');
    
    if (req.file) {
      // File was uploaded
      const uploadDir = path.join(uploadsRoot, 'profiles');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Get current user to delete old image
      const currentUser = await userQueries.findByEmail(req.user.email);
      if (currentUser && currentUser.profileImage && currentUser.profileImage.startsWith('/uploads/')) {
        const rel = currentUser.profileImage.replace(/^\/uploads\//, ''); // e.g. profiles/x.png
        const oldImagePath = path.join(uploadsRoot, rel);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      // Save new file with unique name
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileExt = path.extname(req.file.originalname);
      const newFileName = `profile-${uniqueSuffix}${fileExt}`;
      const filePath = path.join(uploadDir, newFileName);
      
      // Write file to disk
      fs.writeFileSync(filePath, req.file.buffer);
      
      // Set profile image path
      profileImagePath = `/uploads/profiles/${newFileName}`;
    }

    // ✅ FIX: Parse form data (can be from multipart/form-data or JSON)
    const updateProfileSchema = z.object({
      name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    
      // ✅ tighten: no spaces, only a-z0-9_ and hyphen
      handle: z.string()
        .min(3, 'Handle must be at least 3 characters')
        .max(20, 'Handle must be at most 20 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Handle can only contain letters, numbers, hyphens, and underscores')
        .optional(),
    
      dob: z.string().optional()
        .refine((value) => {
          if (!value) return true;
          const d = new Date(value);
          if (Number.isNaN(d.getTime())) return false;
          const today = new Date();
          if (d > today) return false;                     // future date
          const ageMs = today.getTime() - d.getTime();
          const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
          return ageYears >= 13;                          // min age 13
        }, 'Please enter a valid date of birth (must be at least 13 years old and not in the future)'),
    
        phone: z.string()
        .optional()
        .refine((value) => {
          // ✅ Optional field - allow empty
          if (!value || value.trim() === '') return true;
          
          // ✅ MUST start with +
          if (!value.trim().startsWith('+')) {
            return false;
          }
          
          // ✅ Split by space: +[country code] [phone number]
          const parts = value.trim().split(/\s+/);
          
          // ✅ Must have exactly 2 parts: [+countryCode] and [phoneNumber]
          if (parts.length !== 2) {
            return false;
          }
          
          const countryCodePart = parts[0]; // e.g. "+91"
          const phoneNumberPart = parts[1];  // e.g. "1234567890"
          
          // ✅ Country code part: must be + followed by 1-3 digits (not starting with 0)
          if (!/^\+[1-9]\d{0,2}$/.test(countryCodePart)) {
            return false; // +1, +91, +123 valid; +0, +01, +0123 invalid
          }
          
          // ✅ Phone number part: must be exactly 10 digits
          if (!/^\d{10}$/.test(phoneNumberPart)) {
            return false;
          }
          
          return true;
        }, 'Phone number must be in format: +[country code] [10 digits] (e.g. +91 1234567890 or +1 1234567890)'),
                      
      bio: z.string().max(300, 'Bio too long').optional(),
      profileImage: z.string().nullable().optional(),
      timeZone: z.string().max(64).optional(),
      socialLinks: z.object({
        twitter: z.string().url().nullable().optional(),
        instagram: z.string().url().nullable().optional(),
        youtube: z.string().url().nullable().optional(),
        website: z.string().url().nullable().optional(),
      }).optional(),
      notificationPreferences: z.object({
        emailNotifications: z.boolean().optional(),
        paymentNotifications: z.boolean().optional(),
        weeklySummary: z.boolean().optional(),
      }).optional(),
      priceConfig: z.unknown().optional(),
    });    

    // ✅ FIX: Parse from req.body (multer will parse multipart/form-data)
    const { name, phone, profileImage, timeZone, socialLinks, notificationPreferences, priceConfig } = updateProfileSchema.parse(req.body);

    // Get current user data
    const currentUser = await userQueries.findByEmail(req.user.email);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare values for update (only name, phone, timezone, profileImage)
    const finalName = name !== undefined ? name : currentUser.name || '';
    const finalPhone = phone !== undefined ? phone : currentUser.phone || '';
    // ✅ FIX: Use uploaded file path if file was uploaded, otherwise use provided profileImage or current
    const finalProfileImage = profileImagePath !== undefined 
      ? profileImagePath 
      : (profileImage !== undefined ? profileImage : currentUser.profileImage || '');

    // Update user profile using raw SQL (handle/bio/dob not used)
    const updatedUser = await userQueries.updateProfile(
      req.user.email,
      finalName,
      '', // handle - not used
      null, // dob - not used
      finalPhone,
      '', // bio - not used
      finalProfileImage,
      timeZone
    );

    // ✅ Save social links if provided
    if (socialLinks !== undefined) {
      await db.query(
        `UPDATE "User" SET "socialLinks" = $1 WHERE email = $2`,
        [JSON.stringify(socialLinks), req.user.email]
      );
      logger.info(`Social links updated for user: ${req.user.email}`);
    }

    // ✅ Save notification preferences if provided
    if (notificationPreferences !== undefined) {
      await db.query(
        `UPDATE "User" SET "notificationPreferences" = $1 WHERE email = $2`,
        [JSON.stringify(notificationPreferences), req.user.email]
      );
      logger.info(`Notification preferences updated for user: ${req.user.email}`);
    }

    // ✅ Save price config if provided
    if (priceConfig !== undefined) {
      if (typeof priceConfig !== 'object' || priceConfig === null || Array.isArray(priceConfig)) {
        return res.status(400).json({ error: 'Invalid priceConfig' });
      }
      await userQueries.updatePricing(currentUser.id, priceConfig);
    }

    return res.json({
      success: true,
      user: {
        name: updatedUser.name,
        phone: updatedUser.phone,
        profileImage: updatedUser.profileImage,
      },
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const exportProfileData = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await db.query(`SELECT * FROM "User" WHERE id=$1 LIMIT 1`, [userId]);
    const identities = await db.query(`SELECT * FROM "identities" WHERE "userId"=$1`, [userId]);
    const identityVersions = await db.query(
      `SELECT iv.* FROM "identity_versions" iv JOIN "identities" i ON i.id = iv."identityId" WHERE i."userId"=$1`,
      [userId]
    );
    const chatSessions = await db.query(`SELECT * FROM "chat_sessions" WHERE "creatorId"=$1`, [userId]);
    const chatMessages = await db.query(
      `SELECT cm.* FROM "chat_messages" cm JOIN "chat_sessions" cs ON cs.id = cm."sessionId" WHERE cs."creatorId"=$1`,
      [userId]
    );
    const payments = await db.query(`SELECT * FROM "stripe_payments" WHERE "creatorId"=$1`, [userId]);
    const knowledgeSources = await db.query(`SELECT * FROM "knowledge_sources" WHERE "userId"=$1`, [userId]);

    const uploads = {
      profileImage: user.rows[0]?.profileImage || null,
      knowledgeSources: knowledgeSources.rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        originalUrl: r.originalUrl,
        storageUrl: r.storageUrl,
      })),
    };

    const zip = new JSZip();
    zip.file('profile.json', JSON.stringify(user.rows[0] || {}, null, 2));
    zip.file('identities.json', JSON.stringify(identities.rows || [], null, 2));
    zip.file('identity_versions.json', JSON.stringify(identityVersions.rows || [], null, 2));
    zip.file('chat_sessions.json', JSON.stringify(chatSessions.rows || [], null, 2));
    zip.file('chat_messages.json', JSON.stringify(chatMessages.rows || [], null, 2));
    zip.file('payments.json', JSON.stringify(payments.rows || [], null, 2));
    zip.file('uploads.json', JSON.stringify(uploads, null, 2));

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="profile-export-${new Date().toISOString().split('T')[0]}.zip"`
    );
    return res.send(buffer);
  } catch (error: any) {
    logger.error('Export profile error:', error);
    return res.status(500).json({ error: 'Failed to export data' });
  }
};

export const requestAccountDeletionOtp = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const email = String(req.user.email || '').toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email not found' });

    const emailService = new EmailService();
    const otp = generateOTP(6);
    const hashed = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await otpQueries.deleteByEmail(email, 'delete');
    await otpQueries.create(email, hashed, expiresAt, 'delete');

    const sent = await emailService.sendOTP(email, otp, 'delete');
    if (!sent) {
      return res.status(500).json({ error: 'Failed to send OTP' });
    }

    return res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error: any) {
    logger.error('Request delete OTP error:', error);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
};

const deleteAccountSchema = z.object({
  otpCode: z.string().length(6).regex(/^\d{6}$/),
});

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { otpCode } = deleteAccountSchema.parse(req.body || {});
    const email = String(req.user.email || '').toLowerCase();

    const otpRecord = await otpQueries.findByEmail(email, 'delete');
    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const nowMs = Date.now();
    const expiresAtMs = otpRecord.expiresAt instanceof Date
      ? otpRecord.expiresAt.getTime()
      : new Date(String(otpRecord.expiresAt)).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < nowMs) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }
    if (otpRecord.used) {
      return res.status(400).json({ error: 'OTP already used. Please request a new one.' });
    }

    const isValid = await verifyOTP(otpCode, otpRecord.codeHash);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    await otpQueries.markAsUsed(otpRecord.id);

    const deletedAt = new Date();
    const deletionScheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.query(
      `UPDATE "User" SET active=false, "deletedAt"=$1, "deletionScheduledAt"=$2 WHERE id=$3`,
      [deletedAt, deletionScheduledAt, userId]
    );
    await db.query(`DELETE FROM "auth_sessions" WHERE "userId"=$1`, [userId]);

    return res.json({
      success: true,
      deletedAt: deletedAt.toISOString(),
      deletionScheduledAt: deletionScheduledAt.toISOString(),
    });
  } catch (error: any) {
    logger.error('Delete account error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    return res.status(500).json({ error: 'Failed to delete account' });
  }
};
```

---

##7 `backend/src/modules/profile/profileRoutes.ts` (replace full file)
```ts
import { Router } from 'express';
import { updateProfile, exportProfileData, requestAccountDeletionOtp, deleteAccount } from './profileController';
import { uploadProfileImage, handleProfileImageUpload } from './uploadController';
import { generateCSRFToken, validateCSRF } from '../../middleware/csrf';
import { sanitizeInput } from '../../middleware/validation';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import multer from 'multer';

const router = Router();

// Apply CSRF token generation to all routes
router.use(generateCSRFToken);

// Configure multer for form data parsing (✅ 5MB limit + image-only)
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const name = String(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    const extOk = allowed.test(name);
    const mimeOk = allowed.test(mime);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Only image files are allowed (jpeg/jpg/png/gif/webp).'));
  }
});
router.post(
  '/update',
  (req, res, next) => {
    upload.single('profileImageFile')(req, res, (err: any) => {
      if (!err) return next();

      // ✅ proper size exceeded error
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'Image too large. Max size is 5MB.'
        });
      }

      return res.status(400).json({
        success: false,
        error: err.message || 'Invalid image upload.'
      });
    });
  },
  requireJWTFromCookie, // ✅ FIX: Check auth first (401), then CSRF (403) - better DX for SPA
  validateCSRF,
  updateProfile
);
router.post(
  '/upload',
  (req, res, next) => {
    uploadProfileImage(req as any, res as any, (err: any) => {
      if (!err) return next();

      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'Image too large. Max size is 5MB.'
        });
      }

      return res.status(400).json({
        success: false,
        error: err.message || 'Invalid image upload.'
      });
    });
  },
  handleProfileImageUpload
);

router.get('/export', requireJWTFromCookie, exportProfileData);
router.post('/account/otp', requireJWTFromCookie, sanitizeInput, validateCSRF, requestAccountDeletionOtp);
router.delete('/account', requireJWTFromCookie, sanitizeInput, validateCSRF, deleteAccount);

export default router;
```

---

##8 `backend/src/config/database.ts` (update select fields)

**Update these 2 query strings**:

### `findByEmail`
```ts
'SELECT id, email, "passwordHash", "googleId", "googleEmail", "googleEmailVerified", handle, name, dob, phone, bio, active, "referralCode", "createdAt", "profileImage", "lastHandleChangeAt", "profileCompleted", "timeZone", "trialEndsAt", "planTier", "onboardingStep", "publicSlug", "creatorTitle", "creatorTags", "priceConfig", "deletedAt", "deletionScheduledAt" FROM "User" WHERE email = $1'
```

### `findById`
```ts
'SELECT id, email, "passwordHash", "googleId", "googleEmail", "googleEmailVerified", handle, name, dob, phone, bio, active, "referralCode", "createdAt", "profileImage", "trialEndsAt", "planTier", "onboardingStep", "publicSlug", "creatorTitle", "creatorTags", "priceConfig", "deletedAt", "deletionScheduledAt" FROM "User" WHERE id = $1'
```

---

##9 `backend/src/modules/auth/authController.ts` (add deletion checks)

### In `login`, insert **after user/passwordHash checks and before `active` check**:
```ts
    if (user.deletedAt || user.deletionScheduledAt) {
      return res.status(403).json({
        error: 'Account deletion requested. Login is disabled.',
        errorCode: 'ACCOUNT_DELETION_REQUESTED',
      });
    }
```

### In `loginVerify`, insert **before `active` check**:
```ts
    if (user.deletedAt || user.deletionScheduledAt) {
      return res.status(403).json({
        error: 'Account deletion requested. Login is disabled.',
        errorCode: 'ACCOUNT_DELETION_REQUESTED',
      });
    }
```

---

##10 `backend/src/modules/auth/googleAuthController.ts` (block deleted accounts)

Insert after `let user = await userQueries.findByEmail(email);`:
```ts
      if (user?.deletedAt || user?.deletionScheduledAt) {
        return done(new Error('Account deletion requested. Login is disabled.'), null);
      }
```

---

##11 `frontend/react-app/src/components/PaymentPrompt.tsx` (replace full file)
```tsx
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentPromptProps {
  creatorId: string;
  sessionId: string;
  paymentOptions: {
    tiers: { amount: number; label: string }[];
    defaultAmount?: number;
  };
  onSuccess: (reply?: string) => void;
  onCancel: () => void;
}

const CheckoutForm: React.FC<{
  creatorId: string;
  sessionId: string;
  paymentOptions: PaymentPromptProps['paymentOptions'];
  onSuccess: () => void;
  onCancel: () => void;
  onClientSecretChange: (secret: string | null) => void;
}> = ({ creatorId, sessionId, paymentOptions, onSuccess, onCancel, onClientSecretChange }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(() => {
    const fallback = paymentOptions.tiers?.[0]?.amount || 500;
    return paymentOptions.defaultAmount && paymentOptions.tiers.some((t) => t.amount === paymentOptions.defaultAmount)
      ? paymentOptions.defaultAmount
      : fallback;
  });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string>('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    // Get visitor ID from localStorage
    const k = 'selflyx_visitor_id';
    const existing = localStorage.getItem(k);
    if (existing) {
      setVisitorId(existing);
    }
  }, []);

  useEffect(() => {
    const fetchPaymentIntent = async () => {
      if (!selectedAmount) return;
      setLoading(true);
      setMessage(null);
      try {
        const selectedTier = paymentOptions.tiers.find((t) => t.amount === selectedAmount);
        const res = await apiFetch<{ clientSecret: string }>(
          '/api/payments/pay-per-chat/intent',
          {
            method: 'POST',
            body: JSON.stringify({
              creatorId,
              amountCents: selectedAmount,
              tierLabel: selectedTier?.label || `$${(selectedAmount / 100).toFixed(2)}`,
              visitorId,
              sessionId,
            }),
          }
        );
        setClientSecret(res.clientSecret);
        onClientSecretChange(res.clientSecret);
      } catch (err: any) {
        setMessage(err.message || 'Failed to create payment intent.');
        onClientSecretChange(null);
      } finally {
        setLoading(false);
      }
    };
    fetchPaymentIntent();
  }, [creatorId, selectedAmount, visitorId, sessionId, onClientSecretChange, paymentOptions.tiers]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (error) {
        setMessage(error.message || 'Payment failed.');
        setLoading(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Confirm payment on backend and get reply
        try {
          const result = await apiFetch<{ success: boolean; reply?: string }>('/api/payments/pay-per-chat/confirm', {
            method: 'POST',
            body: JSON.stringify({
              paymentIntentId: paymentIntent.id,
              sessionId,
              creatorId,
              amountCents: selectedAmount,
            }),
          });
          setPaymentSuccess(true);
          setMessage('Payment succeeded! Your full answer is ready 🎉');
          
          // ✅ Confetti animation on payment success
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#8B5CF6', '#6366F1', '#EC4899', '#F59E0B'],
          });
          
          setTimeout(() => {
            // ✅ Pass the reply to onSuccess callback
            onSuccess(result.reply);
          }, 2000);
        } catch (err: any) {
          setMessage(err.message || 'Payment succeeded but confirmation failed.');
          setLoading(false);
        }
      } else {
        setMessage('Payment processing. Please wait.');
        setLoading(false);
      }
    } catch (err: any) {
      setMessage(err.message || 'Payment failed.');
      setLoading(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="space-y-4 text-center py-8 animate-fade-in">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <CheckCircle2 className="h-16 w-16 text-green-500 animate-scale-in" />
            <Sparkles className="h-8 w-8 text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
          </div>
        </div>
        <h3 className="text-2xl font-bold text-text-primary">Payment Successful!</h3>
        <p className="text-text-secondary">
          Your full answer is being prepared. You'll receive it in the chat and via email.
        </p>
        <div className="pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-full">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Unlocked: ${((selectedAmount || 0) / 100).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tier-select" className="text-base font-semibold">Choose your tier:</Label>
        <Select
          value={String(selectedAmount)}
          onValueChange={(value: string) => {
            const amount = Number(value);
            setSelectedAmount(amount);
            setClientSecret(null); // Reset to fetch new intent
            onClientSecretChange(null);
          }}
        >
          <SelectTrigger id="tier-select" className="h-12">
            <SelectValue placeholder="Select a tier" />
          </SelectTrigger>
          <SelectContent>
            {paymentOptions.tiers.map((tier) => (
              <SelectItem key={tier.amount} value={String(tier.amount)} className="py-3">
                <div className="flex items-center justify-between w-full">
                  <span>{tier.label}</span>
                  <span className="font-semibold ml-4">${(tier.amount / 100).toFixed(2)}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {clientSecret ? (
        <div className="space-y-3">
          <div className="bg-bg-tertiary/50 p-4 rounded-lg border border-border-default">
            <PaymentElement options={{ layout: 'tabs' }} />
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border-default rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading payment form...</span>
            </div>
          ) : (
            'Select a tier to continue'
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button 
          type="submit" 
          className="flex-1 h-12 bg-gradient-to-r from-accent-primary to-accent-secondary hover:opacity-90 transition-all font-semibold" 
          disabled={loading || !stripe || !elements || !clientSecret || paymentSuccess}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Payment...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Pay ${((selectedAmount || 0) / 100).toFixed(2)}
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading || paymentSuccess} className="h-12">
          Cancel
        </Button>
      </div>
      {message && (
        <div className={`text-sm text-center p-3 rounded-lg ${
          message.includes('succeeded') 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
        }`}>
          {message}
        </div>
      )}
    </form>
  );
};

export function PaymentPrompt(props: PaymentPromptProps) {
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);

  if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    return (
      <Card className="glass shadow-sm">
        <CardHeader>
          <CardTitle>Payment Unavailable</CardTitle>
          <CardDescription>Stripe is not configured.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="glass shadow-sm">
      <CardHeader>
        <CardTitle>Unlock Premium Content</CardTitle>
        <CardDescription>
          Choose a tier to unlock a detailed response. You'll receive the full answer via email after payment.
          <div className="mt-2 text-xs text-muted-foreground">
            Platform fee: 25% | Creator earnings: 75%
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stripePromise && (
          <Elements 
            stripe={stripePromise} 
            options={clientSecret ? { clientSecret } : undefined}
          >
            <CheckoutForm {...props} onClientSecretChange={setClientSecret} />
          </Elements>
        )}
      </CardContent>
    </Card>
  );
}
```

---

##12 `frontend/react-app/src/pages/PublicChatPage.tsx` (update types)
Replace the `paymentData` type to:
```tsx
const [paymentData, setPaymentData] = useState<{
  creatorId: string;
  sessionId: string;
  paymentOptions: { tiers: { amount: number; label: string }[]; defaultAmount?: number };
} | null>(null);
```

No other changes required in this file.

---

##13 `frontend/react-app/src/pages/SettingsPage.tsx` (update Payment tab + add export + delete UI)

### 1) Replace payment state block (near top) with:
```tsx
  // Payment settings
  const [payPerChatTiers, setPayPerChatTiers] = useState<number[]>([100, 500, 1000, 2500, 5000]);
  const [defaultTierCents, setDefaultTierCents] = useState(500);
  const [customTierInput, setCustomTierInput] = useState('');
  const [enablePayments, setEnablePayments] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [popularQuestions, setPopularQuestions] = useState<string[]>(['']);
  const [paymentTriggerRules, setPaymentTriggerRules] = useState<{
    keywords: string[];
    minLength: number;
    alwaysRequire: boolean;
  }>({ keywords: [], minLength: 0, alwaysRequire: false });
  const payTierOptions = [
    { label: '$1', value: 100 },
    { label: '$5', value: 500 },
    { label: '$10', value: 1000 },
    { label: '$25', value: 2500 },
    { label: '$50', value: 5000 },
  ];
```

### 2) Add new states (near other state declarations):
```tsx
  const [exportingData, setExportingData] = useState(false);
  const [deleteOtpCode, setDeleteOtpCode] = useState('');
  const [deleteOtpSent, setDeleteOtpSent] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');
```

### 3) In `useEffect` where config is loaded, replace premium/vip lines:
```tsx
      const config = (state.user as any).priceConfig || {};
      const tiers = Array.isArray(config.payPerChatTiers) && config.payPerChatTiers.length
        ? config.payPerChatTiers
        : [100, 500, 1000, 2500, 5000];

      setPayPerChatTiers(tiers);
      const preferred = Number(config.defaultTierCents || 0);
      setDefaultTierCents(tiers.includes(preferred) ? preferred : tiers[0]);

      setEnablePayments(config.enablePayments || false);
      setWelcomeMessage(config.welcomeMessage || '');
      setPopularQuestions(config.popularQuestions?.length ? config.popularQuestions : ['']);
      setPaymentTriggerRules(config.paymentTriggerRules || { keywords: [], minLength: 0, alwaysRequire: false });
```

### 4) Add helper functions (below `formatCurrency`)
```tsx
  const toggleTier = (amount: number) => {
    setPayPerChatTiers((prev) => {
      const next = prev.includes(amount)
        ? prev.filter((x) => x !== amount)
        : [...prev, amount];
      const sorted = next.sort((a, b) => a - b);
      if (!sorted.includes(defaultTierCents)) {
        setDefaultTierCents(sorted[0] || amount);
      }
      return sorted;
    });
  };

  const addCustomTier = () => {
    const dollars = Number(customTierInput);
    if (!Number.isFinite(dollars) || dollars <= 0) return;
    const cents = Math.round(dollars * 100);
    setPayPerChatTiers((prev) => {
      if (prev.includes(cents)) return prev;
      const next = [...prev, cents].sort((a, b) => a - b);
      return next;
    });
    setCustomTierInput('');
  };
```

### 5) Replace `onSavePaymentSettings` body with:
```tsx
      const tiers = payPerChatTiers.length ? payPerChatTiers : [100, 500, 1000, 2500, 5000];
      const safeDefault = tiers.includes(defaultTierCents) ? defaultTierCents : tiers[0];

      const newConfig = {
        enablePayments,
        payPerChatTiers: tiers,
        defaultTierCents: safeDefault,
        premium: { amountCents: tiers[0] },
        vip: { amountCents: tiers[tiers.length - 1] },
        welcomeMessage: welcomeMessage || undefined,
        popularQuestions: popularQuestions.filter(q => q.trim()),
        paymentTriggerRules: paymentTriggerRules,
      };
```

### 6) Replace Payment tab UI (inside `activeTab === 'payment'`) with:
```tsx
                {enablePayments && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select tiers</label>
                      <div className="grid grid-cols-2 gap-2">
                        {payTierOptions.map((opt) => (
                          <label key={opt.value} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={payPerChatTiers.includes(opt.value)}
                              onChange={() => toggleTier(opt.value)}
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Input
                          type="number"
                          min={1}
                          step="0.01"
                          value={customTierInput}
                          onChange={(e) => setCustomTierInput(e.target.value)}
                          placeholder="Custom amount (USD)"
                        />
                        <Button type="button" variant="outline" onClick={addCustomTier}>
                          Add
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Default tier</label>
                      <select
                        className="w-full border rounded-md px-3 py-2 bg-background"
                        value={defaultTierCents}
                        onChange={(e) => setDefaultTierCents(Number(e.target.value))}
                      >
                        {payPerChatTiers.map((amount) => (
                          <option key={amount} value={amount}>
                            {formatCurrency(amount)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Welcome Message</label>
                      <Input
                        value={welcomeMessage}
                        onChange={(e) => setWelcomeMessage(e.target.value)}
                        placeholder="Hey! I'm here to help. Ask me anything!"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Popular Questions</label>
                      {popularQuestions.map((q, i) => (
                        <Input
                          key={i}
                          value={q}
                          onChange={(e) => {
                            const newQs = [...popularQuestions];
                            newQs[i] = e.target.value;
                            setPopularQuestions(newQs);
                          }}
                          placeholder={`Question ${i + 1}`}
                          className="mb-2"
                        />
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPopularQuestions([...popularQuestions, ''])}
                      >
                        Add Question
                      </Button>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                      <label className="text-sm font-medium">Payment Trigger Rules</label>
                      <p className="text-xs text-muted-foreground">
                        Configure when payment should be required (in addition to the 3 free messages limit)
                      </p>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="alwaysRequire"
                          checked={paymentTriggerRules.alwaysRequire}
                          onChange={(e) => setPaymentTriggerRules({ ...paymentTriggerRules, alwaysRequire: e.target.checked })}
                          className="rounded"
                        />
                        <label htmlFor="alwaysRequire" className="text-sm cursor-pointer">
                          Always require payment (after free messages)
                        </label>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Keywords (comma-separated)</label>
                        <Input
                          value={paymentTriggerRules.keywords.join(', ')}
                          onChange={(e) => {
                            const keywords = e.target.value.split(',').map(k => k.trim()).filter(Boolean);
                            setPaymentTriggerRules({ ...paymentTriggerRules, keywords });
                          }}
                          placeholder="consultation, detailed, premium, urgent"
                        />
                        <p className="text-xs text-muted-foreground">
                          Questions containing these keywords will require payment
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Minimum Length (characters)</label>
                        <Input
                          type="number"
                          value={paymentTriggerRules.minLength || 0}
                          onChange={(e) => setPaymentTriggerRules({ ...paymentTriggerRules, minLength: parseInt(e.target.value) || 0 })}
                          min={0}
                          placeholder="0 = disabled"
                        />
                        <p className="text-xs text-muted-foreground">
                          Questions longer than this will require payment (0 to disable)
                        </p>
                      </div>
                    </div>
                  </>
                )}
```

### 7) Add Data Export handler (near other handlers):
```tsx
  const handleExportData = async () => {
    setExportingData(true);
    setError('');
    try {
      const res = await fetch('/api/profile/export', {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to export data');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profile-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      setError(e.message || 'Failed to export data');
    } finally {
      setExportingData(false);
    }
  };
```

### 8) Add Delete Account handlers (near other handlers):
```tsx
  const requestDeleteOtp = async () => {
    setDeleteInProgress(true);
    setDeleteError('');
    setDeleteSuccess('');
    try {
      await apiFetch('/api/profile/account/otp', { method: 'POST' });
      setDeleteOtpSent(true);
      setDeleteSuccess('OTP sent to your email.');
    } catch (e: any) {
      setDeleteError(e.message || 'Failed to send OTP');
    } finally {
      setDeleteInProgress(false);
    }
  };

  const confirmDeleteAccount = async () => {
    setDeleteInProgress(true);
    setDeleteError('');
    setDeleteSuccess('');
    try {
      await apiFetch('/api/profile/account', {
        method: 'DELETE',
        body: JSON.stringify({ otpCode: deleteOtpCode }),
      });
      setDeleteSuccess('Account deletion requested. Login will be disabled.');
    } catch (e: any) {
      setDeleteError(e.message || 'Failed to delete account');
    } finally {
      setDeleteInProgress(false);
    }
  };
```

### 9) Add UI blocks in **Security tab** (after Active Sessions card is fine):
```tsx
            <Card className="glass">
              <CardHeader>
                <CardTitle>Data Export</CardTitle>
                <CardDescription>Download your profile, chats, payments, and uploads in a ZIP file.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleExportData} disabled={exportingData}>
                  {exportingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Download Export
                </Button>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Delete Account</CardTitle>
                <CardDescription>Soft delete with a 30‑day grace period. Login will be blocked.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {deleteError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{deleteError}</AlertDescription>
                  </Alert>
                )}
                {deleteSuccess && (
                  <Alert>
                    <Check className="h-4 w-4" />
                    <AlertDescription>{deleteSuccess}</AlertDescription>
                  </Alert>
                )}
                <Button variant="outline" onClick={requestDeleteOtp} disabled={deleteInProgress || deleteOtpSent}>
                  {deleteInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send OTP
                </Button>
                {deleteOtpSent && (
                  <div className="space-y-2">
                    <Label>OTP Code</Label>
                    <Input
                      value={deleteOtpCode}
                      onChange={(e) => setDeleteOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                    />
                    <Button
                      variant="destructive"
                      onClick={confirmDeleteAccount}
                      disabled={deleteInProgress || deleteOtpCode.length !== 6}
                    >
                      {deleteInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Confirm Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
```

---

##14 `frontend/react-app/src/pages/Integrations.tsx` (update pricing block)

### 1) Replace pricing state block with:
```tsx
  // Pricing state
  const [payPerChatTiers, setPayPerChatTiers] = useState<number[]>([100, 500, 1000, 2500, 5000]);
  const [defaultTierCents, setDefaultTierCents] = useState(500);
  const [pricingSaving, setPricingSaving] = useState(false);
  const payTierOptions = [
    { label: '$1', value: 100 },
    { label: '$5', value: 500 },
    { label: '$10', value: 1000 },
    { label: '$25', value: 2500 },
    { label: '$50', value: 5000 },
  ];
```

### 2) Replace `savePricing` with:
```tsx
  const savePricing = async () => {
    setPricingSaving(true);
    try {
      const tiers = payPerChatTiers.length ? payPerChatTiers : [100, 500, 1000, 2500, 5000];
      const safeDefault = tiers.includes(defaultTierCents) ? defaultTierCents : tiers[0];

      await apiFetch('/api/creator/pricing', {
        method: 'POST',
        body: JSON.stringify({
          free: { enabled: true },
          payPerChatTiers: tiers,
          defaultTierCents: safeDefault,
          premium: { enabled: true, amountCents: tiers[0] },
          vip: { enabled: true, amountCents: tiers[tiers.length - 1] },
        }),
      });
      alert('Saved pricing');
    } catch (e: any) {
      alert(e.message || 'Failed to save pricing');
    } finally {
      setPricingSaving(false);
    }
  };
```

### 3) Replace pricing UI (inside “Standalone Link + Pricing” card) with:
```tsx
            <div className="space-y-2">
              <div className="text-sm font-medium mb-1">Select tiers</div>
              <div className="grid grid-cols-2 gap-2">
                {payTierOptions.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={payPerChatTiers.includes(opt.value)}
                      onChange={() => {
                        setPayPerChatTiers((prev) => {
                          const next = prev.includes(opt.value)
                            ? prev.filter((x) => x !== opt.value)
                            : [...prev, opt.value];
                          return next.sort((a, b) => a - b);
                        });
                      }}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-1">Default tier</div>
              <select
                className="w-full border rounded-md px-3 py-2 bg-background"
                value={defaultTierCents}
                onChange={(e) => setDefaultTierCents(Number(e.target.value))}
              >
                {payPerChatTiers.map((amount) => (
                  <option key={amount} value={amount}>
                    ${((amount / 100)).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
```

---

##15 `frontend/react-app/src/pages/PublicChatPage.tsx` (type update only)
Already covered above.

---

If you want **full‑file dumps** for `SettingsPage.tsx` or `Integrations.tsx`, say the word and I’ll paste full files.