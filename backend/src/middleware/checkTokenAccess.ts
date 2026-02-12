/**
 * Token Access Middleware
 * Checks if user has sufficient token access before allowing chat messages
 * Priority: Subscription → Token Pack → Free Tier
 */

import { Request, Response, NextFunction } from 'express';
import {
  estimateTokens,
  getActiveSubscription,
  getTokenPackBalance,
  getFreeUsageThisPeriod,
  checkCreatorQuota,
  checkRateLimit,
  TokenAccessResult,
} from '../services/tokenService';
import { logger } from '../config/logger';

// Constants
const FREE_TIER_LIMIT = 10000; // 10K tokens per month per creator

/**
 * Main token access checking function
 * Determines if user can send a message based on:
 * 1. Rate limiting
 * 2. Creator's platform quota
 * 3. User's subscription/token pack/free tier status
 */
export async function checkTokenAccess(
  userId: string,
  creatorId: string,
  sessionId: string,
  messageLength: number
): Promise<TokenAccessResult> {
  try {
    // Step 0: Estimate tokens needed for this message
    const estimatedTokens = estimateTokens(messageLength);

    logger.debug('Checking token access', {
      userId,
      creatorId,
      messageLength,
      estimatedTokens,
    });

    // Step 1: Check rate limiting first (security)
    const rateLimitOk = await checkRateLimit(userId, creatorId);
    if (!rateLimitOk) {
      logger.warn('Rate limit exceeded', { userId, creatorId });
      return {
        allowed: false,
        reason: 'Rate limit exceeded. Please slow down.',
        rateLimitHit: true,
      };
    }

    // Step 2: Check creator's quota (platform-level check)
    const creatorQuota = await checkCreatorQuota(creatorId);
    if (!creatorQuota.allowed) {
      logger.warn('Creator quota exceeded', { creatorId });
      return {
        allowed: false,
        reason:
          'Creator has reached their monthly limit. Please try again later.',
        accessType: undefined,
      };
    }

    // Step 3: Priority 1 - Check for active subscription
    const subscription = await getActiveSubscription(userId, creatorId);
    if (subscription) {
      const tokensUsed = subscription.tokens_used_this_period || 0;
      const tokenLimit = subscription.token_limit; // can be null/undefined
      const tokensRemaining =
        tokenLimit == null ? Number.POSITIVE_INFINITY : tokenLimit - tokensUsed;

      logger.debug('Subscription found', {
        userId,
        creatorId,
        tokensUsed,
        tokenLimit,
        tokensRemaining,
      });

      if (tokensRemaining >= estimatedTokens) {
        // Has enough tokens in subscription
        return {
          allowed: true,
          accessType: 'subscription',
          tokensAvailable: tokenLimit == null ? undefined : tokensRemaining,
          estimatedTokensNeeded: estimatedTokens,
        };
      }

      // Subscription exists but exhausted, fall through to token packs
      logger.debug('Subscription exhausted, checking token packs', {
        userId,
        creatorId,
      });
    }

    // Step 4: Priority 2 - Check for token packs
    const tokenPack = await getTokenPackBalance(userId, creatorId);
    if (tokenPack && tokenPack.total_remaining >= estimatedTokens) {
      logger.debug('Token pack found', {
        userId,
        creatorId,
        remaining: tokenPack.total_remaining,
      });

      return {
        allowed: true,
        accessType: 'token_pack',
        tokensAvailable: tokenPack.total_remaining,
        estimatedTokensNeeded: estimatedTokens,
      };
    }

    // Step 5: Priority 3 - Check free tier
    const freeUsage = await getFreeUsageThisPeriod(userId, creatorId);
    const freeRemaining = FREE_TIER_LIMIT - freeUsage;

    logger.debug('Checking free tier', {
      userId,
      creatorId,
      freeUsage,
      freeRemaining,
    });

    if (freeRemaining >= estimatedTokens) {
      return {
        allowed: true,
        accessType: 'free',
        tokensAvailable: freeRemaining,
        estimatedTokensNeeded: estimatedTokens,
      };
    }

    // Step 6: No access available - needs payment
    logger.info('No token access available', { userId, creatorId });
    return {
      allowed: false,
      reason: 'No active subscription or token packs available',
      needsPayment: true,
      accessType: undefined,
    };
  } catch (error) {
    logger.error('Error in checkTokenAccess:', error);
    return {
      allowed: false,
      reason: 'Error checking token access',
      accessType: undefined,
    };
  }
}

/**
 * Express middleware wrapper for token access checking
 * Attaches token access result to request object
 */
export function tokenAccessMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // This is an example middleware that could be used for routes
  // In practice, we call checkTokenAccess directly in the chat controller
  // because we need the message content to estimate tokens

  // For now, this is a placeholder
  next();
}

// Export for use in controllers
export default {
  checkTokenAccess,
  tokenAccessMiddleware,
};
