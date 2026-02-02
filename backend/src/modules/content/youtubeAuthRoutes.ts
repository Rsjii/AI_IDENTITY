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

router.get(
  '/authorize',
  requireJWTFromCookie,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Google not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
    }

    const callbackUrl =
      process.env.YOUTUBE_OAUTH_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/content/social/youtube/callback`;

    const state = randomBytes(24).toString('hex');
    await db.query(
      `INSERT INTO "platform_integrations"(id,"userId",platform,"accessToken",status,config,"createdAt","updatedAt")
       VALUES ($1,$2,'youtube_oauth_state',NULL,'active',$3,NOW(),NOW())
       ON CONFLICT (id)
       DO UPDATE SET config=EXCLUDED.config, "updatedAt"=NOW()`,
      [`pi_youtube_state_${userId}`, userId, JSON.stringify({ state, expiresAt: Date.now() + 10 * 60 * 1000 })]
    );

    const scope = encodeURIComponent('https://www.googleapis.com/auth/youtube.readonly');
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
      `&response_type=code` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&scope=${scope}` +
      `&state=${encodeURIComponent(state)}`;

    return res.redirect(authUrl);
  })
);

router.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    if (!code || !state) return res.redirect(`${getFrontendUrl()}/onboarding/content?error=youtube_oauth_failed`);

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.redirect(`${getFrontendUrl()}/onboarding/content?error=google_not_configured`);
    }

    const callbackUrl =
      process.env.YOUTUBE_OAUTH_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/content/social/youtube/callback`;

    try {
      // match state -> userId
      const rows = await db.query(
        `SELECT "userId", config FROM "platform_integrations"
         WHERE platform='youtube_oauth_state' AND status='active'
         ORDER BY "createdAt" DESC
         LIMIT 50`
      );

      const match = rows.rows
        .map((r: any) => ({ userId: r.userId, config: r.config }))
        .find((r: any) => (r.config?.state || '') === state);

      if (!match?.userId) return res.redirect(`${getFrontendUrl()}/onboarding/content?error=invalid_state`);
      if (match.config?.expiresAt && Date.now() > Number(match.config.expiresAt)) {
        return res.redirect(`${getFrontendUrl()}/onboarding/content?error=state_expired`);
      }

      const userId = match.userId;

      // exchange code -> tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData: any = await tokenRes.json();
      if (!tokenData.access_token) throw new Error('Google token exchange failed: ' + JSON.stringify(tokenData));

      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token || null;

      await db.query(
        `INSERT INTO "platform_integrations"(id,"userId",platform,"accessToken",status,config,"createdAt","updatedAt")
         VALUES ($1,$2,'youtube',$3,'active',$4,NOW(),NOW())
         ON CONFLICT (id)
         DO UPDATE SET "accessToken"=EXCLUDED."accessToken", config=EXCLUDED.config, "updatedAt"=NOW()`,
        [`pi_youtube_${userId}`, userId, accessToken, JSON.stringify({ refreshToken, obtainedAt: new Date().toISOString() })]
      );

      // Get channel
      const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const chData: any = await chRes.json();
      const ch = chData.items?.[0];
      if (!ch) throw new Error('No YouTube channel found for this Google account.');

      const channelId = ch.id;
      const channelTitle = ch.snippet?.title || 'YouTube Channel';
      const uploadsPlaylist = ch.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylist) throw new Error('Uploads playlist not found.');

      // Playlist items (latest 50)
      const plRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(
          uploadsPlaylist
        )}&maxResults=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const plData: any = await plRes.json();
      const items = plData.items || [];

      const parts: string[] = [];
      for (const it of items) {
        const title = it.snippet?.title || '';
        const desc = it.snippet?.description || '';
        const publishedAt = it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt || '';
        const videoId = it.contentDetails?.videoId || '';
        const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';
        parts.push(`Video: ${title}\nPublished: ${publishedAt}\nURL: ${url}\nDescription: ${desc}\n`);
        parts.push('\n---\n');
      }

      const rawText = `YouTube: ${channelTitle}\nChannelId: ${channelId}\n\n` + parts.join('\n');

      const existing = (await knowledgeSourceQueries.listByUserId(userId)).find((s: any) => s.type === 'youtube');
      let source: any;

      if (existing) {
        await knowledgeSourceQueries.update(existing.id, {
          rawText,
          lastFetchedAt: new Date(),
          fetchMetadata: { videos: items.length, channelId },
        });
        source = existing;
      } else {
        source = await knowledgeSourceQueries.create({
          userId,
          type: 'youtube',
          title: `YouTube: ${channelTitle}`,
          originalUrl: `https://www.youtube.com/channel/${channelId}`,
          rawText,
        });
      }

      const chunks = chunkText(rawText);
      await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);

      return res.redirect(`${getFrontendUrl()}/onboarding/content?success=youtube_imported`);
    } catch (e: any) {
      logger.error({ err: e }, '[YouTube OAuth] callback failed');
      return res.redirect(`${getFrontendUrl()}/onboarding/content?error=${encodeURIComponent(e.message || 'youtube_failed')}`);
    }
  })
);

export default router;

