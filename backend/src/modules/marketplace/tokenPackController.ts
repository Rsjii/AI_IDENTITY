/**
 * Token Pack Controller
 * Handles one-time token pack purchases for end users
 * Token packs never expire and can be used with specific creators
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import db from '../../config/db';
import { logger } from '../../config/logger';
import { createOrder } from '../../services/razorpayService';
import { createLemonCheckoutForVariant } from '../../services/lemonSqueezyService';

// =====================================================
// TOKEN PACK CONFIGURATION
// =====================================================

export const TOKEN_PACKS = {
  small: {
    id: 'small',
    name: 'Small Pack',
    tokens: 150000, // 150K tokens (~75 conversation turns)
    price: 500, // $5 USD or ₹500 paise
    conversationTurns: 75,
  },
  medium: {
    id: 'medium',
    name: 'Medium Pack',
    tokens: 350000, // 350K tokens (~175 turns)
    price: 1000, // $10 USD or ₹1000 paise
    conversationTurns: 175,
    popular: true,
  },
  large: {
    id: 'large',
    name: 'Large Pack',
    tokens: 1000000, // 1M tokens (~500 turns)
    price: 2500, // $25 USD or ₹2500 paise
    conversationTurns: 500,
    bestValue: true,
  },
  jumbo: {
    id: 'jumbo',
    name: 'Jumbo Pack',
    tokens: 2500000, // 2.5M tokens (~1250 turns)
    price: 5000, // $50 USD or ₹5000 paise
    conversationTurns: 1250,
  },
} as const;

export type TokenPackSize = keyof typeof TOKEN_PACKS;

// =====================================================
// SCHEMAS
// =====================================================

const getPacksSchema = z.object({
  creatorId: z.string().min(1),
});

const checkoutSchema = z.object({
  creatorId: z.string().min(1),
  packSize: z.enum(['small', 'medium', 'large', 'jumbo']),
  billingCountry: z.string().optional(),
  returnUrl: z.string().url().optional(),
});

const verifySchema = z.object({
  creatorId: z.string().min(1),
  packSize: z.enum(['small', 'medium', 'large', 'jumbo']),
  orderId: z.string(),
  paymentId: z.string(),
  signature: z.string(),
});

const balanceSchema = z.object({
  creatorId: z.string().min(1),
});

// =====================================================
// CONTROLLERS
// =====================================================

/**
 * GET /api/marketplace/token-packs/:creatorId
 * Get available token packs for a creator
 */
export async function getAvailablePacks(req: Request, res: Response) {
  try {
    const { creatorId } = req.params;

    // Verify creator exists
    const creatorResult = await db.query(
      `SELECT id, name, handle FROM "User" WHERE id = $1 AND active = true`,
      [creatorId]
    );

    if (creatorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const creator = creatorResult.rows[0];

    // Return available packs
    const packs = Object.values(TOKEN_PACKS).map((pack) => ({
      id: pack.id,
      name: pack.name,
      tokens: pack.tokens,
      price: pack.price,
      conversationTurns: pack.conversationTurns,
      popular: 'popular' in pack ? pack.popular : false,
      bestValue: 'bestValue' in pack ? pack.bestValue : false,
      description: `~${pack.conversationTurns} conversation turns with ${creator.name || creator.handle}`,
    }));

    return res.json({
      success: true,
      creator: {
        id: creator.id,
        name: creator.name,
        handle: creator.handle,
      },
      packs,
    });
  } catch (error) {
    logger.error('Error getting token packs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/marketplace/token-packs/checkout
 * Create checkout session for token pack purchase
 */
export async function createPackCheckout(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { creatorId, packSize, billingCountry, returnUrl } = checkoutSchema.parse(req.body);

    // Verify creator exists
    const creatorResult = await db.query(
      `SELECT id, name FROM "User" WHERE id = $1 AND active = true`,
      [creatorId]
    );

    if (creatorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const creator = creatorResult.rows[0];
    const pack = TOKEN_PACKS[packSize];

    // Get user info
    const userResult = await db.query(
      `SELECT email, name, phone FROM "User" WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Determine gateway (Razorpay for India, LemonSqueezy for international)
    const isIndia =
      billingCountry === 'IN' ||
      user.phone?.startsWith('+91') ||
      user.phone?.startsWith('91');

    logger.info('Creating token pack checkout', {
      userId,
      creatorId,
      packSize,
      tokens: pack.tokens,
      price: pack.price,
      gateway: isIndia ? 'razorpay' : 'lemonsqueezy',
    });

    if (isIndia) {
      // Razorpay checkout
      const receipt = `token_pack_${packSize}_${userId}_${creatorId}_${Date.now()}`;
      const order = await createOrder({
        amount: pack.price,
        currency: 'INR',
        receipt,
        notes: {
          userId,
          creatorId,
          packSize,
          tokens: pack.tokens.toString(),
          type: 'token_pack',
        },
      });

      return res.json({
        success: true,
        gateway: 'razorpay',
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        keyId: process.env.RAZORPAY_KEY_ID,
        pack: {
          size: packSize,
          tokens: pack.tokens,
          conversationTurns: pack.conversationTurns,
        },
      });
    } else {
      // LemonSqueezy checkout
      // NOTE: You need to set up LemonSqueezy variant IDs for each pack size
      const variantIdMap: Record<string, string> = {
        small: process.env.LEMONSQUEEZY_VARIANT_ID_TOKEN_PACK_SMALL || '',
        medium: process.env.LEMONSQUEEZY_VARIANT_ID_TOKEN_PACK_MEDIUM || '',
        large: process.env.LEMONSQUEEZY_VARIANT_ID_TOKEN_PACK_LARGE || '',
        jumbo: process.env.LEMONSQUEEZY_VARIANT_ID_TOKEN_PACK_JUMBO || '',
      };

      const variantId = variantIdMap[packSize];

      if (!variantId) {
        return res.status(400).json({
          error: 'Token pack variant not configured for LemonSqueezy',
        });
      }

      const checkout = await createLemonCheckoutForVariant({
        variantId,
        userId,
        email: user.email,
        name: user.name || '',
        redirectUrl: returnUrl || `${process.env.FRONTEND_URL}/chat/${creator.name}?pack_purchased=true`,
        custom: {
          userId,
          creatorId,
          packSize,
          tokens: pack.tokens.toString(),
          type: 'token_pack',
        },
      });
      const checkoutUrl = checkout.url;

      return res.json({
        success: true,
        gateway: 'lemonsqueezy',
        checkoutUrl,
        pack: {
          size: packSize,
          tokens: pack.tokens,
          conversationTurns: pack.conversationTurns,
        },
      });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    logger.error('Error creating token pack checkout:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/marketplace/token-packs/verify
 * Verify Razorpay payment and add tokens to user's account
 */
export async function verifyPackPayment(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { creatorId, packSize, orderId, paymentId, signature } = verifySchema.parse(req.body);

    // Verify Razorpay signature
    const crypto = require('crypto');
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const generated = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (generated !== signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const pack = TOKEN_PACKS[packSize];

    // Insert token pack
    await db.query(
      `INSERT INTO token_packs
       (user_id, creator_id, tokens_purchased, tokens_remaining,
        amount_paid_cents, currency, razorpay_order_id, razorpay_payment_id, purchased_at)
       VALUES ($1, $2, $3, $3, $4, 'INR', $5, $6, NOW())`,
      [userId, creatorId, pack.tokens, pack.price, orderId, paymentId]
    );

    // Create ledger entry (25% platform, 75% creator)
    const platformFee = Math.floor(pack.price * 0.25);
    const creatorEarnings = pack.price - platformFee;

    await db.query(
      `INSERT INTO stripe_payments
       (creator_id, payer_user_id, amount, currency, status,
        platform_fee_cents, creator_earnings_cents, type, created_at)
       VALUES ($1, $2, $3, 'INR', 'succeeded', $4, $5, 'token_pack', NOW())`,
      [creatorId, userId, pack.price, platformFee, creatorEarnings]
    );

    logger.info('Token pack purchased', { userId, creatorId, packSize, tokens: pack.tokens });

    return res.json({
      success: true,
      message: 'Token pack purchased successfully',
      pack: {
        size: packSize,
        tokens: pack.tokens,
        conversationTurns: pack.conversationTurns,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    logger.error('Error verifying token pack payment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/marketplace/token-packs/balance
 * Get user's token pack balance with a specific creator
 */
export async function getPackBalance(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { creatorId } = req.query;

    if (!creatorId || typeof creatorId !== 'string') {
      return res.status(400).json({ error: 'Creator ID required' });
    }

    // Get total token pack balance
    const result = await db.query(
      `SELECT
         SUM(tokens_remaining) as total_remaining,
         SUM(tokens_purchased) as total_purchased,
         COUNT(*) as pack_count
       FROM token_packs
       WHERE user_id = $1
       AND creator_id = $2
       AND tokens_remaining > 0`,
      [userId, creatorId]
    );

    const totalRemaining = parseInt(result.rows[0]?.total_remaining || '0');
    const totalPurchased = parseInt(result.rows[0]?.total_purchased || '0');
    const packCount = parseInt(result.rows[0]?.pack_count || '0');

    // Estimate conversation turns (~2000 tokens per turn average)
    const estimatedTurns = Math.floor(totalRemaining / 2000);

    return res.json({
      success: true,
      balance: {
        tokensRemaining: totalRemaining,
        tokensPurchased: totalPurchased,
        packCount,
        estimatedConversationTurns: estimatedTurns,
      },
    });
  } catch (error) {
    logger.error('Error getting token pack balance:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  getAvailablePacks,
  createPackCheckout,
  verifyPackPayment,
  getPackBalance,
  TOKEN_PACKS,
};
