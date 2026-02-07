import { Request, Response } from 'express';
import { z } from 'zod';
import { db, userQueries } from '../../config/database';
import { generateId } from '../../utils/idGenerator';
import { getConnectAccountStatus } from '../../services/stripeConnectService';

function getUserId(req: Request): string | null {
  const u: any = (req as any).user;
  return u?.id || u?.userId || null;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const upsertListingSchema = z.object({
  isPublic: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  title: z.string().max(120).optional(),
  shortPitch: z.string().max(180).optional(),
  thumbnailUrl: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  subscriptionPriceCents: z.number().int().min(0).optional(),
  currency: z.string().max(5).optional(),
  freeTrialQuestions: z.number().int().min(0).max(50).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(30)).max(20).optional(),
  slug: z.string().max(80).optional(),
  enableSubscriptions: z.boolean().optional(),
  enablePayPerChat: z.boolean().optional(),
  enableFreeChat: z.boolean().optional(),
  payPerChatPriceCents: z.number().int().min(0).optional(),
  freeMessageLimit: z.number().int().min(0).optional(),
  publishStatus: z.enum(['draft','ready','published','suspended']).optional(),
});

async function getStripeConnectVerified(userId: string): Promise<boolean> {
  const account = await getConnectAccountStatus(userId);
  if (!account) return false;
  return account.details_submitted === true && account.payouts_enabled === true;
}

function missingBasics(listing: any) {
  const missing: string[] = [];
  if (!String(listing?.title || '').trim()) missing.push('title');
  if (!String(listing?.thumbnailUrl || '').trim()) missing.push('thumbnail');
  if (!String(listing?.category || '').trim()) missing.push('category');
  if (!String(listing?.description || '').trim()) missing.push('description');
  return missing;
}

function validatePricing(listing: any) {
  const missing: string[] = [];
  const subsOn = listing?.enableSubscriptions === true;
  const ppcOn = listing?.enablePayPerChat === true;

  if (!subsOn && !ppcOn) missing.push('choose_monetization');
  if (subsOn && !(Number(listing?.subscriptionPriceCents || 0) > 0)) missing.push('subscription_price');
  if (ppcOn && !(Number(listing?.payPerChatPriceCents || 0) > 0)) missing.push('pay_per_chat_price');

  return missing;
}

export async function getPublicListings(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 20)));
  const offset = (page - 1) * pageSize;

  const category = typeof req.query.category === 'string' ? req.query.category : null;
  const minPrice = typeof req.query.minPrice === 'string' ? Number(req.query.minPrice) : null;
  const maxPrice = typeof req.query.maxPrice === 'string' ? Number(req.query.maxPrice) : null;
  const rating = typeof req.query.rating === 'string' ? Number(req.query.rating) : null;
  const tag = typeof req.query.tag === 'string' ? req.query.tag : null;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : null;
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'popular';
  const featured = req.query.featured === 'true' || req.query.featured === '1';

  const params: any[] = [];
  let where = `"isPublic" = true AND "publishStatus" = 'published'`;

  if (featured) {
    where += ` AND "isFeatured" = true`;
  }
  if (category) {
    params.push(category);
    where += ` AND "category" = $${params.length}`;
  }
  if (Number.isFinite(minPrice)) {
    params.push(minPrice);
    where += ` AND "subscriptionPriceCents" >= $${params.length}`;
  }
  if (Number.isFinite(maxPrice)) {
    params.push(maxPrice);
    where += ` AND "subscriptionPriceCents" <= $${params.length}`;
  }
  if (Number.isFinite(rating)) {
    params.push(rating);
    where += ` AND "rating" >= $${params.length}`;
  }
  if (tag) {
    params.push(tag);
    where += ` AND $${params.length} = ANY("tags")`;
  }
  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    where += ` AND ("description" ILIKE $${idx} OR "slug" ILIKE $${idx})`;
  }

  const isTrending = sort === 'trending';
  const orderBy = (() => {
    switch (sort) {
      case 'newest':
        return `"createdAt" DESC`;
      case 'rating':
        return `"rating" DESC NULLS LAST`;
      case 'price_low':
        return `"subscriptionPriceCents" ASC`;
      case 'price_high':
        return `"subscriptionPriceCents" DESC`;
      case 'trending':
        return `COALESCE(ts."recentSubs", 0) DESC, "totalSubscribers" DESC, "createdAt" DESC`;
      default:
        return `"totalSubscribers" DESC, "createdAt" DESC`;
    }
  })();

  const trendJoin = isTrending
    ? `LEFT JOIN (
         SELECT "listingId", COUNT(*)::int AS "recentSubs"
         FROM "marketplace_subscriptions"
         WHERE "createdAt" >= NOW() - INTERVAL '30 days'
         GROUP BY "listingId"
       ) ts ON ts."listingId" = ml.id`
    : '';

  const listQuery = `
    SELECT ml.*, u.handle, u.name, u."profileImage"
    FROM "marketplace_listings" ml
    ${trendJoin}
    JOIN "User" u ON u.id = ml."creatorId"
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const listParams = [...params, pageSize, offset];
  const rows = await db.query(listQuery, listParams);

  const countQuery = `SELECT COUNT(*)::int AS c FROM "marketplace_listings" WHERE ${where}`;
  const countRes = await db.query(countQuery, params);

  return res.json({
    items: rows.rows.map((r: any) => ({
      id: r.id,
      slug: r.slug,
      isPublic: r.isPublic,
      title: r.title || null,
      shortPitch: r.shortPitch || null,
      thumbnailUrl: r.thumbnailUrl || null,
      category: r.category,
      subscriptionPriceCents: r.subscriptionPriceCents,
      currency: r.currency,
      freeTrialQuestions: r.freeTrialQuestions,
      description: r.description,
      tags: r.tags || [],
      totalSubscribers: r.totalSubscribers,
      rating: r.rating ? Number(r.rating) : null,
      payPerChatPriceCents: r.payPerChatPriceCents ?? null,
      freeMessageLimit: r.freeMessageLimit ?? null,
      enableSubscriptions: r.enableSubscriptions ?? false,
      enablePayPerChat: r.enablePayPerChat ?? false,
      enableFreeChat: r.enableFreeChat ?? true,
      publishStatus: r.publishStatus || 'draft',
      creator: {
        handle: r.handle,
        name: r.name,
        profileImage: r.profileImage || null,
      },
    })),
    page,
    pageSize,
    total: countRes.rows[0]?.c || 0,
  });
}

export async function getListingBySlug(req: Request, res: Response) {
  const slug = String(req.params.slug || '').trim();
  const r = await db.query(
    `SELECT ml.*, u.handle, u.name, u."profileImage", u.bio, u."creatorTitle", u."creatorTags"
     FROM "marketplace_listings" ml
     JOIN "User" u ON u.id = ml."creatorId"
     WHERE ml."slug"=$1 AND ml."isPublic"=true AND ml."publishStatus"='published'
     LIMIT 1`,
    [slug]
  );

  const row = r.rows[0];
  if (!row) return res.status(404).json({ error: 'Listing not found' });

  return res.json({
    id: row.id,
    slug: row.slug,
    isPublic: row.isPublic,
    title: row.title || null,
    shortPitch: row.shortPitch || null,
    thumbnailUrl: row.thumbnailUrl || null,
    category: row.category,
    subscriptionPriceCents: row.subscriptionPriceCents,
    currency: row.currency,
    freeTrialQuestions: row.freeTrialQuestions,
    description: row.description,
    tags: row.tags || [],
    totalSubscribers: row.totalSubscribers,
    rating: row.rating ? Number(row.rating) : null,
    payPerChatPriceCents: row.payPerChatPriceCents ?? null,
    freeMessageLimit: row.freeMessageLimit ?? null,
    enableSubscriptions: row.enableSubscriptions ?? false,
    enablePayPerChat: row.enablePayPerChat ?? false,
    enableFreeChat: row.enableFreeChat ?? true,
    publishStatus: row.publishStatus || 'draft',
    creator: {
      id: row.creatorId,
      handle: row.handle,
      name: row.name,
      profileImage: row.profileImage || null,
      bio: row.bio || '',
      creatorTitle: row.creatorTitle || '',
      creatorTags: row.creatorTags || [],
    },
  });
}

export async function getMyListing(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const r = await db.query(
    `SELECT * FROM "marketplace_listings" WHERE "creatorId"=$1 ORDER BY "createdAt" DESC`,
    [userId]
  );
  
  // Return array for multiple listings support, but maintain backward compatibility
  if (r.rows.length === 0) {
    return res.json({ item: null, items: [] });
  }
  
  // If only one listing, return both formats for backward compatibility
  if (r.rows.length === 1) {
    return res.json({ item: r.rows[0], items: r.rows });
  }
  
  // Multiple listings - return array
  return res.json({ items: r.rows, item: r.rows[0] }); // First one as default for backward compatibility
}

export async function upsertListing(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const user = await userQueries.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const isTrialActive = user.trialEndsAt && new Date(user.trialEndsAt) > new Date();

  const data = upsertListingSchema.parse(req.body);

  // ✅ Only block FREE tier when trying to PUBLISH (not draft saving)
  const isTryingToPublish =
    data.isPublic === true || data.publishStatus === 'published';

  if (isTryingToPublish && user.planTier === 'free' && !isTrialActive) {
    return res.status(403).json({
      error: 'Upgrade to Starter plan to publish on marketplace',
      errorCode: 'UPGRADE_REQUIRED',
      upgradeUrl: '/pricing',
    });
  }

  const existing = await db.query(
    `SELECT * FROM "marketplace_listings" WHERE "creatorId"=$1 LIMIT 1`,
    [userId]
  );

  const current = existing.rows[0] || {};
  const merged = { ...current, ...data };

  // ✅ Enforce publish prerequisites
  if (isTryingToPublish) {
    const missing: string[] = [];
    missing.push(...missingBasics(merged));
    missing.push(...validatePricing(merged));

    const needsStripe = merged.enableSubscriptions === true || merged.enablePayPerChat === true;
    if (needsStripe) {
      const stripeVerified = await getStripeConnectVerified(userId);
      if (!stripeVerified) missing.push('stripe_connect_verified');
    }

    if (missing.length) {
      return res.status(400).json({
        error: 'Publish prerequisites not met',
        errorCode: 'PUBLISH_PREREQ_FAILED',
        missing,
      });
    }

    // normalize publish state
    merged.isPublic = true;
    merged.publishStatus = 'published';
    merged.publishedAt = merged.publishedAt || new Date().toISOString();
  }

  if (existing.rows[0]) {
    const r = await db.query(
      `UPDATE "marketplace_listings"
       SET
         "isPublic" = COALESCE($1, "isPublic"),
         "publishStatus" = COALESCE($2, "publishStatus"),
         "publishedAt" = COALESCE($3, "publishedAt"),
         "isFeatured" = COALESCE($4, "isFeatured"),
         "title" = COALESCE($5, "title"),
         "shortPitch" = COALESCE($6, "shortPitch"),
         "thumbnailUrl" = COALESCE($7, "thumbnailUrl"),
         "category" = COALESCE($8, "category"),
         "subscriptionPriceCents" = COALESCE($9, "subscriptionPriceCents"),
         "currency" = COALESCE($10, "currency"),
         "freeTrialQuestions" = COALESCE($11, "freeTrialQuestions"),
         "description" = COALESCE($12, "description"),
         "tags" = COALESCE($13, "tags"),
         "slug" = COALESCE($14, "slug"),
         "enableSubscriptions" = COALESCE($15, "enableSubscriptions"),
         "enablePayPerChat" = COALESCE($16, "enablePayPerChat"),
         "enableFreeChat" = COALESCE($17, "enableFreeChat"),
         "payPerChatPriceCents" = COALESCE($18, "payPerChatPriceCents"),
         "freeMessageLimit" = COALESCE($19, "freeMessageLimit"),
         "updatedAt" = CURRENT_TIMESTAMP
       WHERE "creatorId"=$20
       RETURNING *`,
      [
        merged.isPublic ?? null,
        merged.publishStatus ?? null,
        merged.publishedAt ?? null,
        data.isFeatured ?? null,
        data.title ?? null,
        data.shortPitch ?? null,
        data.thumbnailUrl ?? null,
        data.category ?? null,
        data.subscriptionPriceCents ?? null,
        data.currency ?? null,
        data.freeTrialQuestions ?? null,
        data.description ?? null,
        data.tags ?? null,
        data.slug ?? null,
        data.enableSubscriptions ?? null,
        data.enablePayPerChat ?? null,
        data.enableFreeChat ?? null,
        data.payPerChatPriceCents ?? null,
        data.freeMessageLimit ?? null,
        userId,
      ]
    );
    return res.json({ item: r.rows[0] });
  }

  // INSERT default draft
  const baseSlug = data.slug
    ? slugify(data.slug)
    : slugify(user?.publicSlug || user?.handle || `creator-${userId}`);
  const slug = `${baseSlug}-${String(Date.now()).slice(-6)}`;
  const id = generateId.marketplaceListing();

  const r = await db.query(
    `INSERT INTO "marketplace_listings"
     ("id","creatorId","slug","isPublic","publishStatus","publishedAt",
      "isFeatured","title","shortPitch","thumbnailUrl",
      "category","subscriptionPriceCents","currency","freeTrialQuestions","description","tags",
      "enableSubscriptions","enablePayPerChat","enableFreeChat",
      "payPerChatPriceCents","freeMessageLimit",
      "createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,now(),now())
     RETURNING *`,
    [
      id,
      userId,
      slug,
      merged.isPublic ?? false,
      merged.publishStatus ?? 'draft',
      merged.publishedAt ?? null,
      data.isFeatured ?? false,
      data.title ?? null,
      data.shortPitch ?? null,
      data.thumbnailUrl ?? null,
      data.category ?? null,
      data.subscriptionPriceCents ?? 0,
      data.currency ?? 'USD',
      data.freeTrialQuestions ?? 0,
      data.description ?? null,
      data.tags ?? null,
      data.enableSubscriptions ?? false,
      data.enablePayPerChat ?? false,
      data.enableFreeChat ?? true,
      data.payPerChatPriceCents ?? null,
      data.freeMessageLimit ?? null,
    ]
  );

  return res.json({ item: r.rows[0] });
}

