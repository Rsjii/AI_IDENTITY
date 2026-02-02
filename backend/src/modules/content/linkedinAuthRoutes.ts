import { Router, Request, Response } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { asyncHandler } from '../../middleware/errorHandler';
import { db, knowledgeSourceQueries, knowledgeChunkQueries } from '../../config/database';
import { randomBytes } from 'crypto';
import { logger } from '../../config/logger';

const router = Router();

// Helper function to get frontend URL for redirects
const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

function chunkText(text: string, chunkSize = 1200): string[] {
  const clean = (text || '').trim();
  if (!clean) return [];
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += chunkSize) out.push(clean.slice(i, i + chunkSize));
  return out;
}

// ✅ Step 1: Initiate LinkedIn OAuth
router.get(
  '/authorize',
  requireJWTFromCookie,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
    const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
    const LINKEDIN_CALLBACK_URL =
      process.env.LINKEDIN_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/content/social/linkedin/callback`;

    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
      return res.status(500).json({
        error: 'LinkedIn OAuth not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env',
      });
    }

    const state = randomBytes(24).toString('hex');

    // Store state (10 min expiry)
    await db.query(
      `INSERT INTO "platform_integrations"(id,"userId",platform,"accessToken",status,config,"createdAt","updatedAt")
       VALUES ($1,$2,'linkedin_oauth_state',NULL,'active',$3,NOW(),NOW())
       ON CONFLICT (id)
       DO UPDATE SET config=EXCLUDED.config, "updatedAt"=NOW()`,
      [`pi_linkedin_state_${userId}`, userId, JSON.stringify({ state, expiresAt: Date.now() + 10 * 60 * 1000 })]
    );

    // LinkedIn OAuth 2.0 scopes
    // Note: w_member_social requires Partner Program approval
    const scope = encodeURIComponent('openid profile email w_member_social');
    const authUrl =
      `https://www.linkedin.com/oauth/v2/authorization` +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(LINKEDIN_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(LINKEDIN_CALLBACK_URL)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${scope}`;

    return res.redirect(authUrl);
  })
);

// ✅ Step 2: LinkedIn OAuth Callback (NO requireJWT here)
router.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');

    if (!code || !state) {
      return res.redirect(`${getFrontendUrl()}/onboarding/content?error=linkedin_oauth_failed`);
    }

    const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
    const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
    const LINKEDIN_CALLBACK_URL =
      process.env.LINKEDIN_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/content/social/linkedin/callback`;

    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
      return res.redirect(`${getFrontendUrl()}/onboarding/content?error=linkedin_not_configured`);
    }

    try {
      // Find userId from stored state
      const rows = await db.query(
        `SELECT "userId", config FROM "platform_integrations"
         WHERE platform='linkedin_oauth_state' AND status='active'
         ORDER BY "createdAt" DESC
         LIMIT 50`
      );

      const match = rows.rows
        .map((r: any) => ({ userId: r.userId, config: r.config }))
        .find((r: any) => (r.config?.state || '') === state);

      if (!match?.userId) {
        return res.redirect(`${getFrontendUrl()}/onboarding/content?error=invalid_state`);
      }

      if (match.config?.expiresAt && Date.now() > Number(match.config.expiresAt)) {
        return res.redirect(`${getFrontendUrl()}/onboarding/content?error=state_expired`);
      }

      const userId = match.userId;

      // Exchange code -> access token
      const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: LINKEDIN_CALLBACK_URL,
          client_id: LINKEDIN_CLIENT_ID,
          client_secret: LINKEDIN_CLIENT_SECRET,
        }),
      });

      if (!tokenRes.ok) {
        const errorData: any = await tokenRes.json().catch(() => ({}));
        logger.warn({ status: tokenRes.status, error: errorData }, '[LinkedIn OAuth] Token exchange failed');
        throw new Error(`LinkedIn token exchange failed: ${tokenRes.status}`);
      }

      const tokenData: any = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new Error('LinkedIn token exchange failed: no access_token');
      }

      const accessToken = tokenData.access_token;

      // Fetch user profile (OpenID Connect)
      logger.info({ userId }, '[LinkedIn OAuth] Fetching user profile');
      const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!profileRes.ok) {
        const errorData: any = await profileRes.json().catch(() => ({}));
        logger.warn({ status: profileRes.status, error: errorData }, '[LinkedIn OAuth] Profile fetch failed');
        throw new Error(`LinkedIn profile fetch failed: ${profileRes.status}`);
      }

      const profileData: any = await profileRes.json();
      const linkedinName = profileData.name || profileData.given_name || 'LinkedIn User';
      const linkedinEmail = profileData.email || '';

      logger.info({ userId, name: linkedinName, email: linkedinEmail }, '[LinkedIn OAuth] Profile fetched');

      // Store integration
      await db.query(
        `INSERT INTO "platform_integrations"(id,"userId",platform,"accessToken",status,config,"createdAt","updatedAt")
         VALUES ($1,$2,'linkedin',$3,'active',$4,NOW(),NOW())
         ON CONFLICT (id)
         DO UPDATE SET "accessToken"=EXCLUDED."accessToken", config=EXCLUDED.config, "updatedAt"=NOW()`,
        [
          `pi_linkedin_${userId}`,
          userId,
          accessToken,
          JSON.stringify({ name: linkedinName, email: linkedinEmail, profileId: profileData.sub }),
        ]
      );

      // Try to fetch posts (requires Partner Program approval)
      let postsText = '';
      let postsCount = 0;

      try {
        logger.info({ userId }, '[LinkedIn OAuth] Attempting to fetch posts');
        
        // Get person URN from profile
        const personUrn = `urn:li:person:${profileData.sub}`;
        
        // Fetch UGC Posts (requires w_member_social scope + Partner Program)
        const postsRes = await fetch(
          `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(personUrn)})&count=100`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'X-Restli-Protocol-Version': '2.0.0',
            },
          }
        );

        if (postsRes.ok) {
          const postsData: any = await postsRes.json();
          const posts = postsData.elements || [];

          if (posts.length > 0) {
            postsText = posts
              .map((post: any) => {
                const text = post.specificContent?.['com.linkedin.ugc.ShareContent']?.text?.text || '';
                const createdAt = post.created?.time || '';
                const postUrl = post.id ? `https://www.linkedin.com/feed/update/${post.id}` : '';
                return `Post: ${postUrl}\nDate: ${createdAt}\nText:\n${text}\n`;
              })
              .join('\n---\n\n');
            postsCount = posts.length;
            logger.info({ userId, postsCount }, '[LinkedIn OAuth] Posts fetched successfully');
          } else {
            logger.info({ userId }, '[LinkedIn OAuth] No posts found');
          }
        } else {
          const errorData: any = await postsRes.json().catch(() => ({}));
          logger.warn(
            { status: postsRes.status, error: errorData, userId },
            '[LinkedIn OAuth] Posts API failed (may need Partner Program approval)'
          );
          // Don't throw - connection still succeeds, just no posts
        }
      } catch (postsError: any) {
        logger.warn({ error: postsError.message, userId }, '[LinkedIn OAuth] Posts fetch error (non-fatal)');
        // Continue without posts - connection still succeeds
      }

      // Build content text
      const content = `LinkedIn Profile: ${linkedinName}${linkedinEmail ? ` (${linkedinEmail})` : ''}\n\n${postsText || 'No posts available. Posts API may require LinkedIn Partner Program approval.'}`;

      // Check if knowledge source already exists
      const existing = (await knowledgeSourceQueries.listByUserId(userId)).find(
        (s: any) => s.type === 'linkedin'
      );

      let source: any;
      if (existing) {
        await knowledgeSourceQueries.update(existing.id, {
          rawText: content,
          lastFetchedAt: new Date(),
          fetchMetadata: {
            name: linkedinName,
            email: linkedinEmail,
            postsCount,
            hasPosts: postsCount > 0,
          },
        });
        source = existing;
      } else {
        source = await knowledgeSourceQueries.create({
          userId,
          type: 'linkedin',
          title: `LinkedIn: ${linkedinName}`,
          originalUrl: profileData.profile || '',
          rawText: content,
          fetchMetadata: {
            name: linkedinName,
            email: linkedinEmail,
            postsCount,
            hasPosts: postsCount > 0,
          },
        });
      }

      // Chunk and store
      const chunks = chunkText(content);
      await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);

      logger.info({ userId, sourceId: source.id, postsCount }, '[LinkedIn OAuth] LinkedIn import completed');

      return res.redirect(`${getFrontendUrl()}/onboarding/content?success=linkedin_imported`);
    } catch (error: any) {
      logger.error({ error: error.message, stack: error.stack }, '[LinkedIn OAuth] Callback error');
      return res.redirect(
        `${getFrontendUrl()}/onboarding/content?error=${encodeURIComponent(error.message || 'linkedin_failed')}`
      );
    }
  })
);

export default router;