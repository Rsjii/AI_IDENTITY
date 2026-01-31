import { Router, Request, Response } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { asyncHandler } from '../../middleware/errorHandler';
import { db, knowledgeSourceQueries, knowledgeChunkQueries } from '../../config/database';
import { randomBytes } from 'crypto';
import { logger } from '../../config/logger';

const router = Router();

function chunkText(text: string, chunkSize = 1200): string[] {
  const clean = (text || '').trim();
  if (!clean) return [];
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += chunkSize) out.push(clean.slice(i, i + chunkSize));
  return out;
}

router.get(
  '/authorize',
  requireJWTFromCookie,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const META_APP_ID = process.env.META_APP_ID;
    const META_APP_SECRET = process.env.META_APP_SECRET;
    if (!META_APP_ID || !META_APP_SECRET) {
      return res.status(500).json({ error: 'Meta not configured. Set META_APP_ID and META_APP_SECRET.' });
    }

    const callbackUrl =
      process.env.INSTAGRAM_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/content/social/instagram/callback`;

    const state = randomBytes(24).toString('hex');

    await db.query(
      `INSERT INTO "platform_integrations"(id,"userId",platform,"accessToken",status,config,"createdAt","updatedAt")
       VALUES ($1,$2,'instagram_oauth_state',NULL,'active',$3,NOW(),NOW())
       ON CONFLICT (id)
       DO UPDATE SET config=EXCLUDED.config, "updatedAt"=NOW()`,
      [`pi_instagram_state_${userId}`, userId, JSON.stringify({ state, expiresAt: Date.now() + 10 * 60 * 1000 })]
    );

    // Net best practice: use Facebook Login dialog for IG Professional
    const scope = encodeURIComponent('pages_show_list,instagram_basic,instagram_manage_comments');
    const authUrl =
      `https://www.facebook.com/v18.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(META_APP_ID)}` +
      `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
      `&state=${encodeURIComponent(state)}` +
      `&response_type=code` +
      `&scope=${scope}`;

    return res.redirect(authUrl);
  })
);

router.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');

    if (!code || !state) return res.redirect('/onboarding/content?error=instagram_oauth_failed');

    const META_APP_ID = process.env.META_APP_ID;
    const META_APP_SECRET = process.env.META_APP_SECRET;
    if (!META_APP_ID || !META_APP_SECRET) {
      return res.redirect('/onboarding/content?error=meta_not_configured');
    }

    const callbackUrl =
      process.env.INSTAGRAM_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/content/social/instagram/callback`;

    try {
      // find userId from stored state
      const rows = await db.query(
        `SELECT "userId", config FROM "platform_integrations"
         WHERE platform='instagram_oauth_state' AND status='active'
         ORDER BY "createdAt" DESC
         LIMIT 50`
      );

      const match = rows.rows
        .map((r: any) => ({ userId: r.userId, config: r.config }))
        .find((r: any) => (r.config?.state || '') === state);

      if (!match?.userId) return res.redirect('/onboarding/content?error=invalid_state');

      if (match.config?.expiresAt && Date.now() > Number(match.config.expiresAt)) {
        return res.redirect('/onboarding/content?error=state_expired');
      }

      const userId = match.userId;

      // exchange code -> short-lived user token
      const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
      tokenUrl.searchParams.set('client_id', META_APP_ID);
      tokenUrl.searchParams.set('redirect_uri', callbackUrl);
      tokenUrl.searchParams.set('client_secret', META_APP_SECRET);
      tokenUrl.searchParams.set('code', code);

      const tokenRes = await fetch(tokenUrl.toString());
      const tokenData: any = await tokenRes.json();
      if (!tokenData.access_token) throw new Error('Meta token exchange failed: ' + JSON.stringify(tokenData));

      // exchange -> long-lived user token
      const longUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
      longUrl.searchParams.set('grant_type', 'fb_exchange_token');
      longUrl.searchParams.set('client_id', META_APP_ID);
      longUrl.searchParams.set('client_secret', META_APP_SECRET);
      longUrl.searchParams.set('fb_exchange_token', tokenData.access_token);

      const longRes = await fetch(longUrl.toString());
      const longData: any = await longRes.json();
      if (!longData.access_token) throw new Error('Meta long-lived token failed: ' + JSON.stringify(longData));
      const userAccessToken = longData.access_token;

      // Get pages
      const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${encodeURIComponent(userAccessToken)}`);
      const pagesData: any = await pagesRes.json();
      const pageId = pagesData.data?.[0]?.id;
      if (!pageId) throw new Error('No Facebook Page found. IG Professional must be connected to a Page.');

      // Get IG business account
      const igRes = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(userAccessToken)}`
      );
      const igData: any = await igRes.json();
      const igUser = igData.instagram_business_account;
      const igUserId = igUser?.id;
      const igUsername = igUser?.username;

      if (!igUserId || !igUsername) {
        throw new Error('No Instagram Business account linked. Needs IG Professional + FB Page link.');
      }

      // Store integration
      await db.query(
        `INSERT INTO "platform_integrations"(id,"userId",platform,"accessToken",status,config,"createdAt","updatedAt")
         VALUES ($1,$2,'instagram',$3,'active',$4,NOW(),NOW())
         ON CONFLICT (id)
         DO UPDATE SET "accessToken"=EXCLUDED."accessToken", config=EXCLUDED.config, "updatedAt"=NOW()`,
        [
          `pi_instagram_${userId}`,
          userId,
          userAccessToken,
          JSON.stringify({ pageId, igUserId, username: igUsername, obtainedAt: new Date().toISOString() }),
        ]
      );

      // Import media
      const mediaRes = await fetch(
        `https://graph.facebook.com/v18.0/${igUserId}/media?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&limit=50&access_token=${encodeURIComponent(
          userAccessToken
        )}`
      );
      const mediaData: any = await mediaRes.json();
      const media = mediaData.data || [];

      // Import comments (best-effort)
      const parts: string[] = [];
      for (const m of media.slice(0, 50)) {
        parts.push(
          `Post: ${m.permalink}\nType: ${m.media_type}\nTime: ${m.timestamp}\nLikes: ${m.like_count || 0}\nCommentsCount: ${
            m.comments_count || 0
          }\nCaption: ${(m.caption || '').trim()}\n`
        );

        if (m.comments_count && m.comments_count > 0) {
          try {
            const cRes = await fetch(
              `https://graph.facebook.com/v18.0/${m.id}/comments?fields=text,timestamp,username&limit=50&access_token=${encodeURIComponent(
                userAccessToken
              )}`
            );
            const cData: any = await cRes.json();
            const comments = cData.data || [];
            if (comments.length) {
              parts.push(
                `Comments:\n` +
                  comments
                    .map((c: any) => `- (${c.timestamp}) ${c.username || 'user'}: ${(c.text || '').trim()}`)
                    .join('\n') +
                  `\n`
              );
            }
          } catch {
            // ignore
          }
        }

        parts.push('\n---\n');
      }

      const rawText = `Instagram: @${igUsername}\n\n` + parts.join('\n');

      const existing = (await knowledgeSourceQueries.listByUserId(userId)).find((s: any) => s.type === 'instagram');

      let source: any;
      if (existing) {
        await knowledgeSourceQueries.update(existing.id, {
          rawText,
          lastFetchedAt: new Date(),
          fetchMetadata: { posts: media.length, username: igUsername },
        });
        source = existing;
      } else {
        source = await knowledgeSourceQueries.create({
          userId,
          type: 'instagram',
          title: `Instagram: @${igUsername}`,
          originalUrl: `https://instagram.com/${igUsername}`,
          rawText,
        });
      }

      const chunks = chunkText(rawText);
      await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);

      return res.redirect('/onboarding/content?success=instagram_imported');
    } catch (e: any) {
      logger.error({ err: e }, '[Instagram OAuth] callback failed');
      return res.redirect(`/onboarding/content?error=${encodeURIComponent(e.message || 'instagram_failed')}`);
    }
  })
);

export default router;

