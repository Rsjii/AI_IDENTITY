import { Request, Response } from 'express';
import { getStripe, getStripePriceId, mustGetStripeWebhookSecret } from '../../services/stripeService';
import { db } from '../../config/database';
import { logger } from '../../config/logger';

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

function normalizeTier(input: string): 'starter' | 'growth' | 'scale' {
  // Phase 1 naming: Basic ($49/5K) → starter, Pro ($99/25K) → growth, Scale ($199/unlimited) → scale
  if (input === 'pro') return 'growth'; // Frontend sends 'pro' for the $99/25K tier
  if (input === 'starter' || input === 'growth' || input === 'scale') return input;
  throw new Error('Invalid tier');
}

export async function createCheckoutSession(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const tierRaw = String(req.body?.tier || '');
  let tier: 'starter' | 'growth' | 'scale';
  try {
    tier = normalizeTier(tierRaw);
  } catch {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  const returnUrl = req.body?.returnUrl || '/onboarding/deploy?paid=1';
  const frontendUrl = getFrontendUrl();

  const stripe = getStripe();

  // Fetch user details for Stripe customer (required for India export regulations)
  const userResult = await db.query(
    `SELECT id, email, name, phone FROM "User" WHERE id=$1 LIMIT 1`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Check if customer already exists
  const existing = await db.query(
    `SELECT "stripeCustomerId" FROM "stripe_customers" WHERE "userId"=$1 LIMIT 1`,
    [userId]
  );

  let customerId: string;
  if (existing.rows[0]?.stripeCustomerId) {
    customerId = existing.rows[0].stripeCustomerId;
    
    // Update existing customer with name/email if missing (for India export compliance)
    try {
      await stripe.customers.update(customerId, {
        name: user.name || undefined,
        email: user.email,
        metadata: { userId },
      });
    } catch (err: any) {
      logger.warn(`[Stripe] Failed to update customer ${customerId}:`, err.message);
    }
  } else {
    // Create new customer with name and email (required for India export regulations)
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || undefined,
      phone: user.phone || undefined,
      metadata: { userId },
    });
    customerId = customer.id;
    await db.query(
      `INSERT INTO "stripe_customers" ("id","userId","stripeCustomerId","createdAt")
       VALUES ($1,$2,$3,now())
       ON CONFLICT ("userId") DO UPDATE SET "stripeCustomerId"=EXCLUDED."stripeCustomerId"`,
      [`sc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, userId, customerId]
    );
  }

  try {
    // Check if user already has an active subscription (to avoid duplicate trials)
    const existingSub = await db.query(
      `SELECT sc."stripeCustomerId" FROM "stripe_customers" sc
       JOIN "User" u ON u.id = sc."userId"
       WHERE sc."userId"=$1 AND u."planTier" != 'free'`,
      [userId]
    );
    const hasActiveSubscription = existingSub.rows.length > 0;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: getStripePriceId(tier), quantity: 1 }],
      success_url: `${frontendUrl}${returnUrl.startsWith('/') ? returnUrl : '/' + returnUrl}`,
      cancel_url: `${frontendUrl}${returnUrl.includes('settings') ? '/settings?tab=billing' : '/onboarding/plan?cancelled=1'}`,
      metadata: { userId, tier },
      // ✅ India Export Compliance: Require billing address collection
      // This is mandatory for export transactions from India
      billing_address_collection: 'required',
      // ✅ Trial period: 14 days for new subscriptions only
      subscription_data: hasActiveSubscription ? undefined : {
        trial_period_days: 14,
      },
      // Also collect shipping address if needed (optional, but good for compliance)
      // shipping_address_collection: { allowed_countries: ['IN', 'US', 'GB', 'CA', 'AU'] },
    });

    return res.json({ url: session.url });
  } catch (error: any) {
    logger.error('[Stripe Checkout] Error creating session:', {
      error: error.message,
      type: error.type,
      code: error.code,
    });
    
    // Handle specific Stripe errors
    if (error.type === 'StripeInvalidRequestError') {
      // India export regulations error
      if (error.message?.includes('export transactions require a customer name and address') || 
          error.message?.includes('india-exports') ||
          error.code === 'parameter_invalid_empty') {
        return res.status(400).json({
          error: 'Customer information required',
          errorCode: 'INDIA_EXPORT_COMPLIANCE',
          message: 'As per Indian regulations, export transactions require customer name and address. Please ensure your profile is complete.',
          details: error.message,
          helpUrl: 'https://stripe.com/docs/india-exports',
        });
      }
      
      if (error.message?.includes('account or business name')) {
        return res.status(400).json({
          error: 'Stripe account setup required',
          errorCode: 'STRIPE_ACCOUNT_SETUP_REQUIRED',
          message: 'Please set your business name in Stripe Dashboard: https://dashboard.stripe.com/account',
          details: error.message,
        });
      }
    }
    
    // Generic error
    return res.status(500).json({
      error: 'Failed to create checkout session',
      errorCode: 'CHECKOUT_ERROR',
      message: error.message || 'Unknown error',
    });
  }
}

export async function stripeWebhook(req: Request, res: Response) {
  const stripe = getStripe();
  const secret = mustGetStripeWebhookSecret();

  const sig = req.headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') {
    logger.error('[Stripe Webhook] Missing stripe-signature header');
    return res.status(400).send('Missing stripe-signature');
  }

  let event;
  try {
    // req.body must be Buffer because express.raw
    event = stripe.webhooks.constructEvent(req.body as any, sig, secret);
    logger.info(`[Stripe Webhook] Received event: ${event.type} (id: ${event.id})`);
  } catch (err: any) {
    logger.error('[Stripe Webhook] Signature verification failed:', {
      error: err.message,
      path: req.path,
    });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle checkout.session.completed - subscription created
    if (event.type === 'checkout.session.completed') {
      const sess: any = event.data.object;
      const userId = sess?.metadata?.userId;
      const tier = sess?.metadata?.tier;

      let normalizedTier: 'starter' | 'growth' | 'scale' | null = null;
      try {
        normalizedTier = tier ? normalizeTier(tier) : null;
      } catch {
        normalizedTier = null;
      }
      if (userId && normalizedTier) {
        await db.query(`UPDATE "User" SET "planTier"=$1 WHERE id=$2`, [normalizedTier, userId]);

        // Phase 2: Auto-create marketplace listing for paid plans
        if (['starter', 'growth', 'scale'].includes(normalizedTier)) {
          const user = await db.query(`SELECT id, "publicSlug", handle, "priceConfig" FROM "User" WHERE id=$1 LIMIT 1`, [userId]);
          if (user.rows[0]) {
            const existingListing = await db.query(
              `SELECT id FROM "marketplace_listings" WHERE "creatorId"=$1 LIMIT 1`,
              [userId]
            );

            if (!existingListing.rows[0]) {
              // Create new listing with pricing from marketplace_listings (if exists) or priceConfig
              // Check if pricing was set during onboarding (in marketplace_listings via setPricing)
              const pricingCheck = await db.query(
                `SELECT "payPerChatPriceCents", "subscriptionPriceCents", "freeMessageLimit" 
                 FROM "marketplace_listings" WHERE "creatorId"=$1 LIMIT 1`,
                [userId]
              );
              
              let payPerChatPriceCents = 1000;
              let subscriptionPriceCents = 0;
              let freeMessageLimit = 3;
              
              if (pricingCheck.rows[0]?.payPerChatPriceCents) {
                // Use pricing from marketplace_listings (set during onboarding)
                payPerChatPriceCents = pricingCheck.rows[0].payPerChatPriceCents;
                subscriptionPriceCents = pricingCheck.rows[0].subscriptionPriceCents || 0;
                freeMessageLimit = pricingCheck.rows[0].freeMessageLimit ?? 3;
              } else {
                // Fallback to priceConfig
                const priceConfig = user.rows[0].priceConfig || {};
                payPerChatPriceCents = priceConfig.defaultTierCents || priceConfig.payPerChatPriceCents || 1000;
                subscriptionPriceCents = priceConfig.subscriptionPriceCents || 0;
                freeMessageLimit = priceConfig.freeMessageLimit ?? 3;
              }
              
              const baseSlug = user.rows[0].publicSlug || user.rows[0].handle || `creator-${userId}`;
              const slug = `${baseSlug}-${String(Date.now()).slice(-6)}`;
              const { generateId } = await import('../../utils/idGenerator');
              const id = generateId.marketplaceListing();

              await db.query(
                `INSERT INTO "marketplace_listings"
                 ("id", "creatorId", "slug", "payPerChatPriceCents", "subscriptionPriceCents", "freeMessageLimit", "isPublic", "createdAt", "updatedAt")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())`,
                [id, userId, slug, payPerChatPriceCents, subscriptionPriceCents, freeMessageLimit, true]
              );

              logger.info(`[Stripe] ✅ Auto-created marketplace listing for user ${userId} on ${normalizedTier} upgrade`);
            }
          }
        }

        // Phase 3: Paid plan selected => next step is stripe_connect (if not connected) or deploy
        const { userQueries } = await import('../../config/database');
        const userCheck = await db.query(`SELECT "stripeConnectId" FROM "User" WHERE id=$1 LIMIT 1`, [userId]);
        const hasStripeConnect = !!userCheck.rows[0]?.stripeConnectId;
        
        if (hasStripeConnect) {
          // Already connected, go to deploy
          await userQueries.updateOnboardingStep(userId, 'deploy');
        } else {
          // Need to connect Stripe, go to stripe_connect step
          await userQueries.updateOnboardingStep(userId, 'stripe_connect');
        }

        logger.info(`[Stripe] ✅ Updated user ${userId} to tier ${normalizedTier} from checkout.session.completed`);
      } else if (sess?.metadata?.type === 'marketplace_subscription') {
        const listingId = sess?.metadata?.listingId;
        const subscriptionId = sess?.subscription;
        if (listingId && userId && subscriptionId) {
          await db.query(
            `INSERT INTO "marketplace_subscriptions"
             ("id","listingId","userId","stripeSubscriptionId","status","createdAt","updatedAt")
             VALUES ($1,$2,$3,$4,'active',now(),now())
             ON CONFLICT ("stripeSubscriptionId") DO UPDATE SET "status"='active', "updatedAt"=now()`,
            [`mkt_sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, listingId, userId, subscriptionId]
          );
          await db.query(
            `UPDATE "marketplace_listings" SET "totalSubscribers" = "totalSubscribers" + 1 WHERE id=$1`,
            [listingId]
          );
          logger.info(`[Stripe] ✅ Marketplace subscription activated: listing=${listingId} user=${userId}`);
        }
      } else {
        logger.warn(`[Stripe] Invalid metadata in checkout.session.completed:`, {
          userId,
          tier,
          sessionId: sess?.id,
        });
      }
    }
    // Handle customer.subscription.created - subscription created (alternative event)
    else if (event.type === 'customer.subscription.created') {
      const subscription: any = event.data.object;
      const customerId = subscription?.customer;
      
      // Get customer metadata to find userId
      try {
        const customer = await stripe.customers.retrieve(customerId);
        const userId = (customer as any)?.metadata?.userId;
        
        if (userId) {
          // Try to get tier from subscription metadata or price
          const priceId = subscription?.items?.data?.[0]?.price?.id;
          // You might need to map price IDs to tiers here
          logger.info(`[Stripe] Subscription created for user ${userId}:`, {
            subscriptionId: subscription?.id,
            customerId,
            priceId,
          });
        }
      } catch (err: any) {
        logger.error(`[Stripe] Error processing customer.subscription.created:`, err.message);
      }
    }
    // Handle customer.subscription.updated - subscription updated
    else if (event.type === 'customer.subscription.updated') {
      const subscription: any = event.data.object;
      const customerId = subscription?.customer;
      const status = subscription?.status;
      const metaType = subscription?.metadata?.type;
      const listingId = subscription?.metadata?.listingId;
      const userIdMeta = subscription?.metadata?.userId;
      
      try {
        const customerResult = await db.query(
          `SELECT "userId" FROM "stripe_customers" WHERE "stripeCustomerId"=$1 LIMIT 1`,
          [customerId]
        );
        
        if (customerResult.rows[0]?.userId) {
          const userId = customerResult.rows[0].userId;
          
          if (status === 'active') {
            // Subscription is active - keep current tier or update if needed
            logger.info(`[Stripe] Subscription updated (active) for user ${userId}:`, {
              subscriptionId: subscription?.id,
              status,
            });
          } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
            // Downgrade to free tier
            await db.query(`UPDATE "User" SET "planTier"='free' WHERE id=$1`, [userId]);
            logger.info(`[Stripe] ✅ Downgraded user ${userId} to free tier after subscription update (status: ${status})`);
          }
        } else {
          logger.warn(`[Stripe] Could not find user for customer ${customerId} in subscription.updated`);
        }
        
        if (metaType === 'marketplace_subscription' && listingId && userIdMeta) {
          const cps = subscription?.current_period_start ? new Date(subscription.current_period_start * 1000) : null;
          const cpe = subscription?.current_period_end ? new Date(subscription.current_period_end * 1000) : null;
          const cancelAtPeriodEnd = !!subscription?.cancel_at_period_end;

          await db.query(
            `UPDATE "marketplace_subscriptions"
             SET
               "status"=$1,
               "currentPeriodStart"=$2,
               "currentPeriodEnd"=$3,
               "cancelAtPeriodEnd"=$4,
               "updatedAt"=now()
             WHERE "stripeSubscriptionId"=$5`,
            [status || 'active', cps, cpe, cancelAtPeriodEnd, subscription?.id]
          );
        }
      } catch (err: any) {
        logger.error(`[Stripe] Error processing customer.subscription.updated:`, err.message);
      }
    }
    // Handle invoice.payment_failed - payment failed
    else if (event.type === 'invoice.payment_failed') {
      const invoice: any = event.data.object;
      const customerId = invoice?.customer;
      const subscriptionId = invoice?.subscription;
      const lastPaymentError = invoice?.last_payment_error;
      
      logger.warn(`[Stripe] ⚠️ Payment failed for invoice:`, {
        invoiceId: invoice?.id,
        customerId,
        subscriptionId,
        amount: invoice?.amount_due,
        attemptCount: invoice?.attempt_count,
        failureReason: lastPaymentError?.message,
        failureCode: lastPaymentError?.code,
        failureType: lastPaymentError?.type,
        // Check if it's India export compliance issue
        isIndiaExportIssue: lastPaymentError?.message?.includes('export transactions require') || 
                           lastPaymentError?.message?.includes('india-exports'),
      });

      // If it's India export compliance issue, log it prominently
      if (lastPaymentError?.message?.includes('export transactions require')) {
        logger.error(`[Stripe] 🚨 India Export Compliance Issue - Payment failed due to missing customer name/address:`, {
          invoiceId: invoice?.id,
          customerId,
          error: lastPaymentError.message,
        });
      }

      // Optional: You can downgrade user or send notification here
      // For now, just log it
    }
    // Handle invoice.payment_succeeded - subscription payment succeeded
    else if (event.type === 'invoice.payment_succeeded') {
      const invoice: any = event.data.object;
      const customerId = invoice?.customer;
      const subscriptionId = invoice?.subscription;
      const amountPaid = invoice?.amount_paid;
      
      logger.info(`[Stripe] ✅ Invoice payment succeeded:`, {
        invoiceId: invoice?.id,
        customerId,
        subscriptionId,
        amountPaid,
      });
      
      // Optional: Update subscription status or send confirmation
      // The subscription should already be active from subscription.created event
      // You can add additional logic here if needed (e.g., send confirmation email)
    }
    // Handle customer.subscription.deleted - subscription cancelled
    else if (event.type === 'customer.subscription.deleted') {
      const subscription: any = event.data.object;
      const customerId = subscription?.customer;
      const metaType = subscription?.metadata?.type;
      
      logger.info(`[Stripe] Subscription cancelled:`, {
        subscriptionId: subscription?.id,
        customerId,
      });

      // Downgrade user to free tier
      try {
        const customerResult = await db.query(
          `SELECT "userId" FROM "stripe_customers" WHERE "stripeCustomerId"=$1 LIMIT 1`,
          [customerId]
        );
        
        if (customerResult.rows[0]?.userId) {
          const userId = customerResult.rows[0].userId;
          await db.query(`UPDATE "User" SET "planTier"='free' WHERE id=$1`, [userId]);
          
          // Phase 2: Hide marketplace listing when downgrading to free tier
          await db.query(
            `UPDATE "marketplace_listings" SET "isPublic"=false WHERE "creatorId"=$1`,
            [userId]
          );
          
          logger.info(`[Stripe] ✅ Downgraded user ${userId} to free tier, marketplace listing hidden`);
        } else {
          logger.warn(`[Stripe] Could not find user for customer ${customerId}`);
        }
      } catch (err: any) {
        logger.error(`[Stripe] Error downgrading user after cancellation:`, err.message);
      }

      if (metaType === 'marketplace_subscription') {
        await db.query(
          `UPDATE "marketplace_subscriptions"
           SET "status"='canceled', "cancelAtPeriodEnd"=false, "cancelledAt"=now(), "updatedAt"=now()
           WHERE "stripeSubscriptionId"=$1`,
          [subscription?.id]
        );
      }
    }
    // ✅ NOTE: payment_intent.succeeded handler removed - pay-per-chat unlock must be ONLY via /api/payments/pay-per-chat/confirm
    // This prevents race conditions where webhook unlocks content before /confirm can process it
    else {
      logger.debug(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error: any) {
    logger.error('[Stripe Webhook] Error processing event:', {
      eventType: event.type,
      eventId: event.id,
      error: error.message,
      stack: error.stack,
    });
    // Still return 200 to prevent Stripe from retrying
    return res.status(200).json({ received: true, error: 'Processing failed' });
  }
}



