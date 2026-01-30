import { Router } from 'express';
import { Request, Response } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { asyncHandler } from '../../middleware/errorHandler';
import { getUserId } from '../../middleware/jwtCookie';
import { db, knowledgeSourceQueries, knowledgeChunkQueries } from '../../config/database';
import { logger } from '../../config/logger';
import { randomBytes } from 'crypto';

const router = Router();

// ✅ Step 1: Initiate Twitter OAuth
router.get('/authorize', requireJWTFromCookie, asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
  const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
  const TWITTER_CALLBACK_URL = process.env.TWITTER_CALLBACK_URL || 
    `${req.protocol}://${req.get('host')}/api/content/social/twitter/callback`;

  if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
    return res.status(500).json({ 
      error: 'Twitter OAuth not configured. Set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET in .env'
    });
  }

  // Generate state (CSRF protection)
  const state = randomBytes(32).toString('hex');
  
  // Store state temporarily (expires in 10 min)
  await db.query(
    `INSERT INTO "platform_integrations" (id, "userId", platform, "accessToken", "metadata", "createdAt")
     VALUES ($1, $2, 'twitter_oauth_state', $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET "accessToken" = $3, "metadata" = $4`,
    [`twitter_state_${userId}`, userId, state, JSON.stringify({ expiresAt: Date.now() + 600000 })]
  );

  // Redirect to Twitter OAuth
  const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${TWITTER_CLIENT_ID}&redirect_uri=${encodeURIComponent(TWITTER_CALLBACK_URL)}&scope=tweet.read%20users.read&state=${state}&code_challenge=challenge&code_challenge_method=plain`;
  
  return res.redirect(authUrl);
}));

// ✅ Step 2: Twitter OAuth Callback
router.get('/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, state } = req.query;
  
  if (!code || !state) {
    return res.redirect('/onboarding/content?error=twitter_oauth_failed');
  }

  const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
  const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
  const TWITTER_CALLBACK_URL = process.env.TWITTER_CALLBACK_URL || 
    `${req.protocol}://${req.get('host')}/api/content/social/twitter/callback`;

  try {
    // Verify state
    const stateResult = await db.query(
      `SELECT "userId" FROM "platform_integrations" 
       WHERE platform = 'twitter_oauth_state' AND "accessToken" = $1`,
      [state]
    );

    if (stateResult.rows.length === 0) {
      return res.redirect('/onboarding/content?error=invalid_state');
    }

    const userId = stateResult.rows[0].userId;

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: TWITTER_CALLBACK_URL,
        code_verifier: 'challenge'
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      throw new Error('Failed to get access token: ' + JSON.stringify(tokenData));
    }

    // Get Twitter user info
    const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=username,name', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    const userData = await userResponse.json();
    const twitterHandle = userData.data?.username;
    const twitterUserId = userData.data?.id;

    if (!twitterHandle) {
      throw new Error('Failed to get Twitter username');
    }

    // Store OAuth tokens
    await db.query(
      `INSERT INTO "platform_integrations" (id, "userId", platform, "accessToken", "refreshToken", "metadata", "createdAt")
       VALUES ($1, $2, 'twitter', $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET "accessToken" = $3, "refreshToken" = $4, "metadata" = $5, "updatedAt" = NOW()`,
      [`twitter_${userId}`, userId, tokenData.access_token, tokenData.refresh_token || null, 
       JSON.stringify({ handle: twitterHandle, userId: twitterUserId })]
    );

    // Fetch and import tweets
    const tweetsResponse = await fetch(
      `https://api.twitter.com/2/users/${twitterUserId}/tweets?max_results=100&tweet.fields=created_at,text,public_metrics&exclude=retweets,replies`,
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      }
    );

    const tweetsData = await tweetsResponse.json();
    const tweets = tweetsData.data || [];

    // Import tweets to knowledge base
    const existingSources = await knowledgeSourceQueries.listByUserId(userId);
    const existingSource = existingSources.find(s => s.type === 'twitter' || (s.type === 'url' && s.originalUrl?.includes('twitter.com')));

    // Chunk text helper
    function chunkText(text: string, maxTokens: number = 300): string[] {
      const words = text.split(/\s+/);
      const chunks: string[] = [];
      let currentChunk: string[] = [];
      let currentTokenCount = 0;

      for (const word of words) {
        const wordTokens = Math.ceil(word.length / 4);
        if (currentTokenCount + wordTokens > maxTokens && currentChunk.length > 0) {
          chunks.push(currentChunk.join(' '));
          currentChunk = [word];
          currentTokenCount = wordTokens;
        } else {
          currentChunk.push(word);
          currentTokenCount += wordTokens;
        }
      }
      if (currentChunk.length > 0) chunks.push(currentChunk.join(' '));
      return chunks;
    }

    let source;
    const content = tweets.map((t: any) => `Tweet: ${t.text}\nDate: ${t.created_at}\nLikes: ${t.public_metrics?.like_count || 0}\n`).join('\n---\n\n');

    if (existingSource) {
      await knowledgeSourceQueries.update(existingSource.id, {
        rawText: content,
        lastFetchedAt: new Date(),
        fetchMetadata: { tweetsCount: tweets.length, handle: twitterHandle }
      });
      source = existingSource;
    } else {
      source = await knowledgeSourceQueries.create({
        userId,
        type: 'twitter',
        title: `Twitter: @${twitterHandle}`,
        originalUrl: `https://twitter.com/${twitterHandle}`,
        rawText: content,
      });
    }

    // Chunk tweets
    const chunks: string[] = [];
    for (const tweet of tweets) {
      const tweetChunks = chunkText(tweet.text, 300);
      chunks.push(...tweetChunks);
    }
    if (chunks.length > 0) {
      await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);
    }

    return res.redirect('/onboarding/content?success=twitter_imported');
  } catch (error: any) {
    logger.error('Twitter OAuth callback error:', error);
    return res.redirect(`/onboarding/content?error=${encodeURIComponent(error.message)}`);
  }
}));

export default router;




