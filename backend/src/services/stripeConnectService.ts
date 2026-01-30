import Stripe from 'stripe';
import { getStripe } from './stripeService';
import { db } from '../config/database';

export async function getOrCreateConnectAccount(userId: string): Promise<string> {
  const r = await db.query(
    `SELECT "stripeConnectId" FROM "User" WHERE id=$1 LIMIT 1`,
    [userId]
  );
  const existing = r.rows[0]?.stripeConnectId;
  if (existing) return existing;

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: 'express',
    metadata: { userId },
  });

  await db.query(
    `UPDATE "User" SET "stripeConnectId"=$1, "updatedAt"=CURRENT_TIMESTAMP WHERE id=$2`,
    [account.id, userId]
  );

  return account.id;
}

export async function createConnectOnboardingLink(userId: string, returnUrl: string, refreshUrl: string): Promise<string> {
  const stripe = getStripe();
  const accountId = await getOrCreateConnectAccount(userId);

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });

  return link.url;
}

export async function getConnectAccountStatus(userId: string): Promise<Stripe.Account | null> {
  const r = await db.query(
    `SELECT "stripeConnectId" FROM "User" WHERE id=$1 LIMIT 1`,
    [userId]
  );
  const accountId = r.rows[0]?.stripeConnectId;
  if (!accountId) return null;
  const stripe = getStripe();
  return stripe.accounts.retrieve(accountId);
}

