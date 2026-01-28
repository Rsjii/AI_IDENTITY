/**
 * A/B Testing Variant Service
 * 
 * Allows Scale plan users to create multiple identity variants and test which performs better
 * Features:
 * - Create variant groups (A/B, A/B/C, etc.)
 * - Weighted variant selection
 * - Metrics tracking per variant
 * - Variant comparison dashboard
 */

import { db, identityQueries, identityVersionQueries } from '../../config/database';
import { logger } from '../../config/logger';

export interface VariantGroup {
  id: string;
  userId: string;
  name: string;
  variants: Array<{
    versionId: string;
    label: string;
    weight: number;
    status: 'active' | 'paused';
  }>;
  createdAt: Date;
}

export interface VariantMetrics {
  variantId: string;
  label: string;
  totalChats: number;
  totalRatings: number;
  avgRating: number;
  positiveRatings: number;
  negativeRatings: number;
  conversionRate: number; // % of chats that resulted in payment
  avgResponseTime: number;
}

/**
 * Check if user has Scale plan (required for A/B testing)
 */
export async function checkScalePlanAccess(userId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT "planTier", "trialEndsAt" FROM "User" WHERE id = $1 LIMIT 1`,
    [userId]
  );
  
  if (result.rows.length === 0) return false;
  
  const user = result.rows[0];
  const tier = user.planTier || 'free';
  const trialActive = user.trialEndsAt && new Date(user.trialEndsAt) > new Date();
  
  // Scale plan or active trial (trials get growth tier access)
  return tier === 'scale' || (tier === 'growth' && trialActive);
}

/**
 * Create a variant group from existing identity version
 */
export async function createVariantGroup(
  userId: string,
  baseVersionId: string,
  variantName: string
): Promise<{ variantGroupId: string; variantVersionId: string }> {
  // Check Scale plan access
  const hasAccess = await checkScalePlanAccess(userId);
  if (!hasAccess) {
    throw new Error('A/B testing is only available on Scale plan. Please upgrade.');
  }

  // Get base version
  const baseVersion = await identityVersionQueries.findById(baseVersionId);
  if (!baseVersion) {
    throw new Error('Base version not found');
  }

  // Verify ownership
  const identity = await identityQueries.findById(baseVersion.identityId);
  if (!identity || identity.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Generate variant group ID
  const variantGroupId = `variant_group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Create variant version (copy of base)
  const variantVersionId = `identity_v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const variantVersion = await db.query(
    `INSERT INTO "identity_versions" 
     (id, "identityId", version, status, "identityJson", "createdFromVersionId", "variantGroupId", "variantLabel", "variantWeight", "createdAt")
     VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8, NOW())
     RETURNING *`,
    [
      variantVersionId,
      baseVersion.identityId,
      `variant-${Date.now()}`,
      baseVersion.identityJson,
      baseVersionId,
      variantGroupId,
      variantName,
      50, // Default weight: 50%
    ]
  );

  // Update base version to be part of variant group
  await db.query(
    `UPDATE "identity_versions" 
     SET "variantGroupId" = $1, "variantLabel" = 'A', "variantWeight" = 50
     WHERE id = $2`,
    [variantGroupId, baseVersionId]
  );

  logger.info(`Variant group created: ${variantGroupId} for user ${userId}`);

  return {
    variantGroupId,
    variantVersionId: variantVersion.rows[0].id,
  };
}

/**
 * Get variant group with all variants
 */
export async function getVariantGroup(userId: string, variantGroupId: string): Promise<VariantGroup | null> {
  const result = await db.query(
    `SELECT iv.*, i."userId"
     FROM "identity_versions" iv
     JOIN "identities" i ON i.id = iv."identityId"
     WHERE iv."variantGroupId" = $1 AND i."userId" = $2
     ORDER BY iv."createdAt" ASC`,
    [variantGroupId, userId]
  );

  if (result.rows.length === 0) return null;

  const variants = result.rows.map((row: any) => ({
    versionId: row.id,
    label: row.variantLabel || 'A',
    weight: row.variantWeight || 50,
    status: row.status,
  }));

  return {
    id: variantGroupId,
    userId,
    name: `Variant Group ${variantGroupId.slice(0, 8)}`,
    variants,
    createdAt: result.rows[0].createdAt,
  };
}

/**
 * Select a variant based on weights (for chat routing)
 */
export async function selectVariant(variantGroupId: string): Promise<string | null> {
  const result = await db.query(
    `SELECT id, "variantLabel", "variantWeight"
     FROM "identity_versions"
     WHERE "variantGroupId" = $1 AND status = 'active'
     ORDER BY "createdAt" ASC`,
    [variantGroupId]
  );

  if (result.rows.length === 0) return null;

  // Calculate total weight
  const totalWeight = result.rows.reduce((sum: number, row: any) => sum + (row.variantWeight || 50), 0);
  
  // Random selection based on weights
  let random = Math.random() * totalWeight;
  
  for (const row of result.rows) {
    const weight = row.variantWeight || 50;
    if (random <= weight) {
      return row.id; // Return version ID
    }
    random -= weight;
  }

  // Fallback to first variant
  return result.rows[0].id;
}

/**
 * Get metrics for all variants in a group
 */
export async function getVariantMetrics(
  userId: string,
  variantGroupId: string
): Promise<VariantMetrics[]> {
  const variants = await db.query(
    `SELECT iv.id, iv."variantLabel"
     FROM "identity_versions" iv
     JOIN "identities" i ON i.id = iv."identityId"
     WHERE iv."variantGroupId" = $1 AND i."userId" = $2`,
    [variantGroupId, userId]
  );

  const metrics: VariantMetrics[] = [];

  for (const variant of variants.rows) {
    const versionId = variant.id;

    // Get chat counts
    const chatsResult = await db.query(
      `SELECT COUNT(DISTINCT cs.id)::int AS total
       FROM "chat_sessions" cs
       JOIN "chat_messages" cm ON cm."sessionId" = cs.id
       JOIN "mirror_runs" mr ON mr."incomingMessage" = cm.content
       WHERE mr."identityVersionId" = $1 AND cm.role = 'user'`,
      [versionId]
    );

    // Get ratings
    const ratingsResult = await db.query(
      `SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE event = 'confirm_yes')::int AS positive,
        COUNT(*) FILTER (WHERE event = 'confirm_no')::int AS negative,
        AVG(CASE WHEN event = 'confirm_yes' THEN 1 WHEN event = 'confirm_no' THEN 0 END)::numeric AS avgRating
       FROM "trust_events" te
       WHERE te."identityVersionId" = $1`,
      [versionId]
    );

    // Get conversion rate (paid chats / total chats)
    const conversionResult = await db.query(
      `SELECT 
        COUNT(DISTINCT cs.id)::int AS total,
        COUNT(DISTINCT CASE WHEN sp.id IS NOT NULL THEN cs.id END)::int AS paid
       FROM "chat_sessions" cs
       JOIN "chat_messages" cm ON cm."sessionId" = cs.id
       JOIN "mirror_runs" mr ON mr."incomingMessage" = cm.content
       LEFT JOIN "stripe_payments" sp ON sp."sessionId" = cs.id AND sp.status = 'succeeded'
       WHERE mr."identityVersionId" = $1 AND cm.role = 'user'`,
      [versionId]
    );

    // Get avg response time
    const responseTimeResult = await db.query(
      `SELECT AVG("latencyMs")::int AS avg
       FROM "mirror_runs"
       WHERE "identityVersionId" = $1 AND "latencyMs" IS NOT NULL`,
      [versionId]
    );

    const totalChats = chatsResult.rows[0]?.total || 0;
    const totalRatings = ratingsResult.rows[0]?.total || 0;
    const positiveRatings = ratingsResult.rows[0]?.positive || 0;
    const negativeRatings = ratingsResult.rows[0]?.negative || 0;
    const avgRating = parseFloat(ratingsResult.rows[0]?.avgRating || '0');
    const totalForConversion = conversionResult.rows[0]?.total || 0;
    const paidChats = conversionResult.rows[0]?.paid || 0;
    const conversionRate = totalForConversion > 0 ? (paidChats / totalForConversion) * 100 : 0;
    const avgResponseTime = responseTimeResult.rows[0]?.avg || 0;

    metrics.push({
      variantId: versionId,
      label: variant.variantLabel || 'A',
      totalChats,
      totalRatings,
      avgRating,
      positiveRatings,
      negativeRatings,
      conversionRate: Math.round(conversionRate * 100) / 100,
      avgResponseTime,
    });
  }

  return metrics;
}

/**
 * Update variant weight
 */
export async function updateVariantWeight(
  userId: string,
  versionId: string,
  weight: number
): Promise<void> {
  if (weight < 0 || weight > 100) {
    throw new Error('Weight must be between 0 and 100');
  }

  // Verify ownership
  const version = await identityVersionQueries.findById(versionId);
  if (!version) {
    throw new Error('Variant not found');
  }

  const identity = await identityQueries.findById(version.identityId);
  if (!identity || identity.userId !== userId) {
    throw new Error('Unauthorized');
  }

  await db.query(
    `UPDATE "identity_versions" SET "variantWeight" = $1 WHERE id = $2`,
    [weight, versionId]
  );

  logger.info(`Variant weight updated: ${versionId} to ${weight}%`);
}

/**
 * Pause/resume variant
 */
export async function toggleVariantStatus(
  userId: string,
  versionId: string,
  status: 'active' | 'paused'
): Promise<void> {
  // Verify ownership
  const version = await identityVersionQueries.findById(versionId);
  if (!version) {
    throw new Error('Variant not found');
  }

  const identity = await identityQueries.findById(version.identityId);
  if (!identity || identity.userId !== userId) {
    throw new Error('Unauthorized');
  }

  await db.query(
    `UPDATE "identity_versions" SET status = $1 WHERE id = $2`,
    [status, versionId]
  );

  logger.info(`Variant status updated: ${versionId} to ${status}`);
}

