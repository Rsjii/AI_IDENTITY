import { Router } from 'express';
import { Request, Response } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { asyncHandler } from '../../middleware/errorHandler';
import { db, knowledgeSourceQueries, knowledgeChunkQueries } from '../../config/database';
import { logger } from '../../config/logger';
import { randomBytes, createHash } from 'crypto';

const router = Router();

// Helper function to get frontend URL for redirects
const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

function base64Url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function makeCodeVerifier() {
  return base64Url(randomBytes(32));
}

function makeCodeChallengeS256(verifier: string) {
  const hash = createHash('sha256').update(verifier).digest();
  return base64Url(hash);
}

// ✅ Step 1: Initiate Twitter OAuth
router.get(
  '/authorize',
  requireJWTFromCookie,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId || req.user?.id || null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
    const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
    const TWITTER_CALLBACK_URL =
      process.env.TWITTER_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/content/social/twitter/callback`;

    if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
      return res.status(500).json({
        error: 'Twitter OAuth not configured. Set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET in .env',
      });
    }

    const state = randomBytes(32).toString('hex');
    const codeVerifier = makeCodeVerifier();
    const codeChallenge = makeCodeChallengeS256(codeVerifier);

    // Store state+verifier (10 min)
    await db.query(
      `INSERT INTO "platform_integrations"(id,"userId",platform,"accessToken",status,config,"createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,'active',$5,NOW(),NOW())
       ON CONFLICT (id)
       DO UPDATE SET "accessToken"=EXCLUDED."accessToken", config=EXCLUDED.config, "updatedAt"=NOW()`,
      [
        `pi_twitter_state_${userId}`,
        userId,
        'twitter_oauth_state',
        null,
        JSON.stringify({ state, codeVerifier, expiresAt: Date.now() + 10 * 60 * 1000 }),
      ]
    );

    const scope = encodeURIComponent('tweet.read users.read offline.access');
    const authUrl =
      `https://twitter.com/i/oauth2/authorize` +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(TWITTER_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(TWITTER_CALLBACK_URL)}` +
      `&scope=${scope}` +
      `&state=${encodeURIComponent(state)}` +
      `&code_challenge=${encodeURIComponent(codeChallenge)}` +
      `&code_challenge_method=S256`;

    return res.redirect(authUrl);
  })
);

// ✅ Step 2: Twitter OAuth Callback (NO requireJWT here)
router.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');

    if (!code || !state) return res.redirect(`${getFrontendUrl()}/onboarding/content?error=twitter_oauth_failed`);

    const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
    const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
    const TWITTER_CALLBACK_URL =
      process.env.TWITTER_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/content/social/twitter/callback`;

    try {
      // Load stored state
      const stateRow = await db.query(
        `SELECT "userId", config FROM "platform_integrations"
         WHERE platform='twitter_oauth_state' AND status='active'
         ORDER BY "createdAt" DESC
         LIMIT 50`
      );

      const match = stateRow.rows
        .map((r: any) => ({ userId: r.userId, config: r.config }))
        .find((r: any) => (r.config?.state || '') === state);

      if (!match?.userId || !match?.config?.codeVerifier) {
        return res.redirect(`${getFrontendUrl()}/onboarding/content?error=invalid_state`);
      }

      if (match.config.expiresAt && Date.now() > Number(match.config.expiresAt)) {
        return res.redirect(`${getFrontendUrl()}/onboarding/content?error=state_expired`);
      }

      const userId = match.userId;
      const codeVerifier = match.config.codeVerifier as string;

      // Exchange code -> token
      const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          redirect_uri: TWITTER_CALLBACK_URL,
          code_verifier: codeVerifier,
        }),
      });

      const tokenData: any = await tokenResponse.json();
      if (!tokenData.access_token) {
        throw new Error('Failed to get access token: ' + JSON.stringify(tokenData));
      }

      // Get user info
      const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=username,name', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      const userData: any = await userResponse.json();
      const twitterHandle = userData.data?.username;
      const twitterUserId = userData.data?.id;

      if (!twitterHandle || !twitterUserId) throw new Error('Failed to get Twitter user');

      // Store integration (✅ correct columns)
      await db.query(
        `INSERT INTO "platform_integrations"(id,"userId",platform,"accessToken",status,config,"createdAt","updatedAt")
         VALUES ($1,$2,'twitter',$3,'active',$4,NOW(),NOW())
         ON CONFLICT (id)
         DO UPDATE SET "accessToken"=EXCLUDED."accessToken", config=EXCLUDED.config, "updatedAt"=NOW()`,
        [
          `pi_twitter_${userId}`,
          userId,
          tokenData.access_token,
          JSON.stringify({
            refreshToken: tokenData.refresh_token || null,
            handle: twitterHandle,
            twitterUserId,
            obtainedAt: new Date().toISOString(),
          }),
        ]
      );

      // Import tweets
      logger.info({ twitterUserId, handle: twitterHandle }, '[Twitter OAuth] Fetching tweets from API');
      
      const tweetsResponse = await fetch(
        `https://api.twitter.com/2/users/${twitterUserId}/tweets?max_results=100&tweet.fields=created_at,text,public_metrics&exclude=retweets,replies`,
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      );

      // ✅ ADD: Check response status
      if (!tweetsResponse.ok) {
        const errorData: any = await tweetsResponse.json().catch(() => ({}));
        logger.warn({ 
          status: tweetsResponse.status, 
          statusText: tweetsResponse.statusText,
          error: errorData,
          twitterUserId,
          handle: twitterHandle
        }, '[Twitter OAuth] Failed to fetch tweets - API error');
        
        // Continue with empty tweets - still save the connection
        const tweets: any[] = [];
        
        // Save source with error message
        const existingSources = await knowledgeSourceQueries.listByUserId(userId);
        const existingSource = existingSources.find((s: any) => s.type === 'twitter');
        
        let source: any;
        const errorMessage = errorData?.error?.message || errorData?.title || errorData?.detail || 'Unknown error';
        const fallbackText = `Twitter: @${twitterHandle}\n\nNo tweets available. This may be due to:\n- Rate limit reached (${tweetsResponse.status})\n- API permissions issue\n- Account has no tweets\n\nError: ${errorMessage}`;
        
        if (existingSource) {
          await knowledgeSourceQueries.update(existingSource.id, {
            rawText: fallbackText,
            lastFetchedAt: new Date(),
            fetchMetadata: { 
              tweetsCount: 0, 
              handle: twitterHandle,
              error: `API returned ${tweetsResponse.status}: ${errorMessage}`,
              apiStatus: tweetsResponse.status
            },
          });
          source = existingSource;
        } else {
          source = await knowledgeSourceQueries.create({
            userId,
            type: 'twitter',
            title: `X/Twitter: @${twitterHandle}`,
            originalUrl: `https://twitter.com/${twitterHandle}`,
            rawText: fallbackText,
            fetchMetadata: {
              tweetsCount: 0,
              handle: twitterHandle,
              error: `API returned ${tweetsResponse.status}: ${errorMessage}`,
              apiStatus: tweetsResponse.status
            },
          });
        }
        
        return res.redirect(`${getFrontendUrl()}/onboarding/content?success=twitter_connected&warning=no_tweets`);
      }

      const tweetsData: any = await tweetsResponse.json();
      const tweets = tweetsData.data || [];

      // ✅ ADD: Log what we got
      logger.info({ 
        tweetsCount: tweets.length,
        twitterUserId,
        handle: twitterHandle,
        responseStatus: tweetsResponse.status,
        hasData: !!tweetsData.data,
        errorInResponse: tweetsData.error || null
      }, '[Twitter OAuth] Tweets API response received');

      // ✅ ADD: Check if tweets are empty
      if (tweets.length === 0) {
        logger.warn({ 
          twitterUserId, 
          handle: twitterHandle,
          responseData: tweetsData
        }, '[Twitter OAuth] No tweets found for user');
        
        // Still save the connection with informative message
        const existingSources = await knowledgeSourceQueries.listByUserId(userId);
        const existingSource = existingSources.find((s: any) => s.type === 'twitter');
        
        let source: any;
        const emptyTweetsText = `Twitter: @${twitterHandle}\n\nNo tweets found. This account may have:\n- No tweets yet\n- All tweets are retweets/replies (excluded by filter)\n- Private account\n- Account suspended or restricted`;
        
        if (existingSource) {
          await knowledgeSourceQueries.update(existingSource.id, {
            rawText: emptyTweetsText,
            lastFetchedAt: new Date(),
            fetchMetadata: { 
              tweetsCount: 0, 
              handle: twitterHandle,
              reason: 'No tweets found - all may be retweets/replies or account has no tweets'
            },
          });
          source = existingSource;
        } else {
          source = await knowledgeSourceQueries.create({
            userId,
            type: 'twitter',
            title: `X/Twitter: @${twitterHandle}`,
            originalUrl: `https://twitter.com/${twitterHandle}`,
            rawText: emptyTweetsText,
            fetchMetadata: {
              tweetsCount: 0,
              handle: twitterHandle,
              reason: 'No tweets found'
            },
          });
        }
        
        return res.redirect(`${getFrontendUrl()}/onboarding/content?success=twitter_connected&warning=no_tweets`);
      }

      // Chunk helper
      function chunkText(text: string, maxTokens: number = 300): string[] {
        const words = text.split(/\s+/);
        const chunks: string[] = [];
        let cur: string[] = [];
        let curTokens = 0;
        for (const w of words) {
          const t = Math.ceil(w.length / 4);
          if (curTokens + t > maxTokens && cur.length) {
            chunks.push(cur.join(' '));
            cur = [w];
            curTokens = t;
          } else {
            cur.push(w);
            curTokens += t;
          }
        }
        if (cur.length) chunks.push(cur.join(' '));
        return chunks;
      }

      // ✅ Log successful fetch
      logger.info({ 
        tweetsCount: tweets.length,
        handle: twitterHandle 
      }, '[Twitter OAuth] Successfully fetched tweets, processing...');

      const content = tweets
        .map((t: any) => `Tweet: ${t.text}\nDate: ${t.created_at}\nLikes: ${t.public_metrics?.like_count || 0}\n`)
        .join('\n---\n\n');

      // ✅ Log content stats
      const contentLength = content.length;
      const estimatedWords = content.split(/\s+/).filter(Boolean).length;
      logger.info({ 
        contentLength,
        estimatedWords,
        tweetsCount: tweets.length 
      }, '[Twitter OAuth] Content generated from tweets');

      const existingSources = await knowledgeSourceQueries.listByUserId(userId);
      const existingSource = existingSources.find((s: any) => s.type === 'twitter');

      let source: any;
      if (existingSource) {
        await knowledgeSourceQueries.update(existingSource.id, {
          rawText: content,
          lastFetchedAt: new Date(),
          fetchMetadata: { 
            tweetsCount: tweets.length, 
            handle: twitterHandle,
            contentLength,
            estimatedWords
          },
        });
        source = existingSource;
      } else {
        source = await knowledgeSourceQueries.create({
          userId,
          type: 'twitter',
          title: `X/Twitter: @${twitterHandle}`,
          originalUrl: `https://twitter.com/${twitterHandle}`,
          rawText: content,
          fetchMetadata: {
            tweetsCount: tweets.length,
            handle: twitterHandle,
            contentLength,
            estimatedWords
          },
        });
      }

      const chunks = tweets.flatMap((t: any) => chunkText(t.text, 300));
      if (chunks.length) {
        await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);
        logger.info({ 
          chunksCount: chunks.length,
          handle: twitterHandle 
        }, '[Twitter OAuth] Chunks created and saved');
      } else {
        logger.warn({ handle: twitterHandle }, '[Twitter OAuth] No chunks created from tweets');
      }

      return res.redirect(`${getFrontendUrl()}/onboarding/content?success=twitter_imported`);
    } catch (error: any) {
      logger.error({ err: error }, 'Twitter OAuth callback error');
      return res.redirect(`${getFrontendUrl()}/onboarding/content?error=${encodeURIComponent(error.message || 'twitter_failed')}`);
    }
  })
);

export default router;
