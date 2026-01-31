import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';

type PlanTier = 'free' | 'starter' | 'growth' | 'scale';

const LIMITS: Record<PlanTier, number> = {
  free: 500,
  starter: 5000,
  growth: 25000,
  scale: Number.MAX_SAFE_INTEGER,
};

async function getUserPlan(userId: string): Promise<{ tier: PlanTier; trialActive: boolean }> {
  const r = await db.query(
    `SELECT "planTier","trialEndsAt"
     FROM "User"
     WHERE id=$1
     LIMIT 1`,
    [userId]
  );

  const tier = (r.rows[0]?.planTier || 'free') as PlanTier;
  const trialEndsAt = r.rows[0]?.trialEndsAt ? new Date(r.rows[0].trialEndsAt) : null;
  const trialActive = !!(trialEndsAt && trialEndsAt.getTime() > Date.now());

  return { tier, trialActive };
}

async function countCreatorChatsThisMonth(creatorId: string): Promise<number> {
  const r = await db.query(
    `SELECT COUNT(*)::int AS c
     FROM "chat_sessions"
     WHERE "creatorId"=$1 AND "createdAt" >= date_trunc('month', now())`,
    [creatorId]
  );
  return r.rows[0]?.c || 0;
}

/**
 * Gate creator usage limits (PHASE1: 500/5k/25k/unlimited per month)
 * Attach after auth for creator endpoints.
 */
export function requirePlanCapacity(params?: { creatorIdFrom?: 'authUser' | 'body.creatorId' }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = (req as any).user?.id as string | undefined;
      const creatorId =
        params?.creatorIdFrom === 'body.creatorId'
          ? (req.body?.creatorId as string | undefined)
          : authUserId;

      if (!creatorId) return res.status(401).json({ error: 'Unauthorized' });

      const { tier, trialActive } = await getUserPlan(creatorId);

      // Trial unlocks Growth behavior
      const effectiveTier: PlanTier = trialActive ? 'growth' : tier;
      const limit = LIMITS[effectiveTier];

      const used = await countCreatorChatsThisMonth(creatorId);

      if (used >= limit) {
        return res.status(402).json({
          error: 'Plan limit reached',
          errorCode: 'PLAN_LIMIT_REACHED',
          tier: effectiveTier,
          used,
          limit,
          upgradeUrl: '/pricing',
        });
      }

      return next();
    } catch (e: any) {
      return res.status(500).json({ error: 'Plan gate failed', details: e?.message });
    }
  };
}









