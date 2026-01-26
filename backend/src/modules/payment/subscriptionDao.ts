import { db } from '../../config/database';
import { generateId } from '../../utils/idGenerator';

export type SubscriptionTier = 'free' | 'pro' | 'teams';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due';

export const subscriptionQueries = {
  async findActiveByUserId(userId: string) {
    const r = await db.query(
      `SELECT * FROM "subscriptions"
       WHERE "userId"=$1 AND "status"='active'
       ORDER BY "createdAt" DESC
       LIMIT 1`,
      [userId]
    );
    return r.rows[0] || null;
  },

  async createActive(params: {
    userId: string;
    tier: Exclude<SubscriptionTier, 'free'>;
    amount: number;
    currency?: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    periodDays?: number;
  }) {
    const id = generateId.subscription();
    const now = new Date();
    const end = new Date(now.getTime() + (params.periodDays ?? 30) * 24 * 60 * 60 * 1000);

    const r = await db.query(
      `INSERT INTO "subscriptions"
        ("id","userId","tier","status","razorpayOrderId","razorpayPaymentId","amount","currency","billingCycle","currentPeriodStart","currentPeriodEnd","createdAt","updatedAt")
       VALUES
        ($1,$2,$3,'active',$4,$5,$6,$7,'monthly',$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       RETURNING *`,
      [id, params.userId, params.tier, params.razorpayOrderId, params.razorpayPaymentId, params.amount, params.currency || 'INR', now, end]
    );
    return r.rows[0];
  },

  async cancelAtPeriodEnd(userId: string) {
    const r = await db.query(
      `UPDATE "subscriptions"
       SET "cancelAtPeriodEnd"=true, "updatedAt"=CURRENT_TIMESTAMP
       WHERE "userId"=$1 AND "status"='active'
       RETURNING *`,
      [userId]
    );
    return r.rows[0] || null;
  },

  async cancelNow(userId: string) {
    const r = await db.query(
      `UPDATE "subscriptions"
       SET "status"='cancelled', "cancelledAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP
       WHERE "userId"=$1 AND "status"='active'
       RETURNING *`,
      [userId]
    );
    return r.rows[0] || null;
  },
};

