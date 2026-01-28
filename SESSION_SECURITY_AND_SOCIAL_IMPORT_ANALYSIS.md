# 🔐 Session Security & Social Import - Complete Analysis

## 1️⃣ SESSION SECURITY - Kaise Ensure Karoge

### Current Implementation Analysis

**✅ What's Working:**
- JWT tokens stored in HTTP-only cookies (prevents XSS)
- Secure flag in production (prevents MITM)
- SameSite protection (prevents CSRF)
- Token validation on every request
- Auth sessions tracked in database

**❌ Security Gaps (Industry Best Practices Missing):**

1. **NO Refresh Token Mechanism**
   - Current: Single JWT with 7-day expiry
   - Problem: If token is compromised, attacker has 7 days access
   - Best Practice: Short-lived access tokens (15-30 min) + long-lived refresh tokens

2. **NO Token Rotation**
   - Current: Same token reused until expiry
   - Problem: Stolen token works until expiry
   - Best Practice: Rotate tokens on each refresh

3. **NO Session Revocation Check**
   - Current: JWT validated but not checked against `auth_sessions.revokedAt`
   - Problem: Revoked sessions still work until token expires
   - Best Practice: Validate session status on every request

4. **NO Rate Limiting on Auth Endpoints**
   - Current: Basic rate limiting exists but not session-specific
   - Problem: Brute force attacks possible
   - Best Practice: Rate limit per IP + per user

### Recommended Implementation (Industry Standard)

```typescript
// 1. Add refresh token to auth_sessions table
ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "refreshToken" TEXT UNIQUE;
ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" TIMESTAMPTZ;

// 2. Generate short-lived access token (15 min) + refresh token (30 days)
const accessToken = generateJWT({ userId, email }, { expiresIn: '15m' });
const refreshToken = generateRandomToken(); // Store in DB, not in JWT

// 3. Middleware to check session revocation
export const requireJWTFromCookie = async (req, res, next) => {
  const token = req.cookies?.jwtToken;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  const decoded = verifyJWT(token);
  
  // ✅ NEW: Check if session is revoked
  const session = await db.query(
    `SELECT "revokedAt" FROM "auth_sessions" 
     WHERE "userId" = $1 AND "lastActiveAt" > NOW() - INTERVAL '1 hour'`,
    [decoded.userId]
  );
  
  if (session.rows[0]?.revokedAt) {
    res.clearCookie('jwtToken');
    return res.status(401).json({ error: 'Session revoked' });
  }
  
  // ✅ NEW: Auto-refresh if token expires in < 5 min
  const expiresIn = decoded.exp * 1000 - Date.now();
  if (expiresIn < 5 * 60 * 1000) {
    await refreshAccessToken(req, res, decoded.userId);
  }
  
  req.user = decoded;
  next();
};

// 4. Refresh token endpoint
POST /api/auth/refresh
Body: { refreshToken }
→ Returns: { accessToken, refreshToken (new) }
```

### Security Checklist

- [x] HTTP-only cookies
- [x] Secure flag in production
- [x] SameSite protection
- [ ] **Refresh token mechanism** (CRITICAL)
- [ ] **Session revocation check** (CRITICAL)
- [ ] **Token rotation** (IMPORTANT)
- [ ] **Rate limiting per session** (IMPORTANT)
- [ ] **IP address validation** (optional but recommended)

---

## 2️⃣ SOCIAL IMPORT - Actual Data Fetching Strategy

### Current Implementation Analysis

**YouTube:**
- ✅ Basic API integration exists
- ✅ Fetches video metadata (title, description)
- ❌ No video transcripts (most valuable content)
- ❌ No pagination (only 50 videos)
- ❌ No incremental updates (re-fetches everything)

**Twitter:**
- ❌ Only placeholder
- ❌ No OAuth flow
- ❌ No actual data fetching

### Recommended Implementation (Production-Ready)

#### A. YouTube Data Import (Enhanced)

```typescript
// 1. Fetch channel videos with pagination
async function fetchAllYouTubeVideos(channelId: string, apiKey: string) {
  let allVideos = [];
  let nextPageToken = null;
  
  do {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&maxResults=50&order=date&key=${apiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    
    allVideos.push(...data.items);
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);
  
  return allVideos;
}

// 2. Fetch video transcripts (using YouTube Transcript API or manual extraction)
async function fetchVideoTranscript(videoId: string) {
  // Option A: Use youtube-transcript library (unofficial but works)
  const { YoutubeTranscript } = require('youtube-transcript');
  const transcript = await YoutubeTranscript.fetchTranscript(videoId);
  return transcript.map(t => t.text).join(' ');
  
  // Option B: Use YouTube Data API captions (requires OAuth)
  // More complex but official
}

// 3. Store in knowledge_chunks for RAG
async function importYouTubeChannel(userId: string, channelUrl: string) {
  const channelId = extractChannelId(channelUrl);
  const videos = await fetchAllYouTubeVideos(channelId, YOUTUBE_API_KEY);
  
  for (const video of videos) {
    // Fetch transcript
    const transcript = await fetchVideoTranscript(video.id.videoId);
    
    // Chunk transcript (500-1000 tokens per chunk)
    const chunks = chunkText(transcript, { maxTokens: 800 });
    
    // Store each chunk
    for (const chunk of chunks) {
      await knowledgeChunkQueries.create({
        sourceId: videoSource.id,
        content: chunk,
        metadata: {
          videoId: video.id.videoId,
          title: video.snippet.title,
          publishedAt: video.snippet.publishedAt,
        }
      });
    }
  }
}
```

**Required Setup:**
1. Get YouTube Data API v3 key from Google Cloud Console
2. Enable "YouTube Data API v3" in your project
3. Set quota: 10,000 units/day (1 search = 100 units, so ~100 searches/day)

#### B. Twitter/X Data Import (Full Implementation)

```typescript
// 1. OAuth 2.0 Flow (User authorizes)
GET /api/content/social/twitter/authorize
→ Redirects to Twitter OAuth
→ Callback: /api/content/social/twitter/callback
→ Stores access_token in database

// 2. Fetch user tweets
async function fetchTwitterTweets(userId: string, handle: string) {
  // Get stored OAuth token
  const oauthToken = await getTwitterOAuthToken(userId);
  
  // Fetch user ID first
  const userRes = await fetch(
    `https://api.twitter.com/2/users/by/username/${handle}`,
    { headers: { Authorization: `Bearer ${oauthToken}` } }
  );
  const userData = await userRes.json();
  const twitterUserId = userData.data.id;
  
  // Fetch tweets (last 100)
  const tweetsRes = await fetch(
    `https://api.twitter.com/2/users/${twitterUserId}/tweets?max_results=100&tweet.fields=created_at,text,public_metrics`,
    { headers: { Authorization: `Bearer ${oauthToken}` } }
  );
  const tweetsData = await tweetsRes.json();
  
  // Store in knowledge base
  const content = tweetsData.data.map(t => 
    `Tweet: ${t.text}\nLikes: ${t.public_metrics.like_count}\nDate: ${t.created_at}\n`
  ).join('\n---\n\n');
  
  return content;
}
```

**Required Setup:**
1. Create Twitter Developer account
2. Create app in Twitter Developer Portal
3. Get API Key, API Secret, Bearer Token
4. Set up OAuth 2.0 callback URL
5. Request "Read" permissions

#### C. LinkedIn Data Import (Future)

```typescript
// LinkedIn requires OAuth 2.0 + Partner Program approval
// Similar flow to Twitter but more restricted
async function fetchLinkedInPosts(userId: string) {
  const oauthToken = await getLinkedInOAuthToken(userId);
  
  const postsRes = await fetch(
    'https://api.linkedin.com/v2/ugcPosts',
    { headers: { Authorization: `Bearer ${oauthToken}` } }
  );
  
  // Process and store
}
```

### Data Fetching Best Practices

1. **Incremental Updates**
   - Store `lastFetchedAt` timestamp
   - Only fetch new content since last fetch
   - Avoid re-processing old content

2. **Rate Limiting**
   - YouTube: 10,000 units/day (plan accordingly)
   - Twitter: 300 requests/15 min (use queue)
   - Implement exponential backoff on errors

3. **Error Handling**
   - Retry failed requests (max 3 attempts)
   - Log errors for debugging
   - Graceful degradation (save URL if API fails)

4. **Content Chunking**
   - Split long content into 500-1000 token chunks
   - Store with metadata (source, timestamp, URL)
   - Enable RAG to find relevant chunks

---

## 3️⃣ IMPLEMENTATION PRIORITY

### Phase 1: Critical Security Fixes (Do First)

1. **Add Refresh Token Mechanism**
   - Update `auth_sessions` table
   - Create `/api/auth/refresh` endpoint
   - Update middleware to auto-refresh

2. **Session Revocation Check**
   - Validate `revokedAt` on every request
   - Invalidate JWT if session revoked

3. **Token Rotation**
   - Generate new refresh token on each refresh
   - Revoke old refresh token

### Phase 2: Enhanced Social Import (Do Next)

1. **YouTube Transcripts**
   - Integrate youtube-transcript library
   - Fetch and chunk transcripts
   - Store in knowledge_chunks

2. **Twitter OAuth Flow**
   - Implement OAuth 2.0 authorization
   - Store tokens securely
   - Fetch tweets and store

3. **Incremental Updates**
   - Track last fetch timestamp
   - Only import new content

### Phase 3: Production Hardening

1. **Rate Limiting**
   - Per-user rate limits
   - Per-IP rate limits
   - Queue system for API calls

2. **Monitoring**
   - Log all API calls
   - Track quota usage
   - Alert on errors

---

## 📋 Quick Reference: Environment Variables Needed

```bash
# Session Security
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# YouTube
YOUTUBE_API_KEY=your-youtube-api-key

# Twitter
TWITTER_API_KEY=your-twitter-api-key
TWITTER_API_SECRET=your-twitter-api-secret
TWITTER_BEARER_TOKEN=your-bearer-token
TWITTER_CALLBACK_URL=https://yourapp.com/api/content/social/twitter/callback

# LinkedIn (future)
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
```

---

## 🎯 Summary

**Session Security:**
- Current: Basic JWT in HTTP-only cookies ✅
- Missing: Refresh tokens, revocation checks, token rotation ❌
- Action: Implement refresh token mechanism ASAP

**Social Import:**
- Current: YouTube basic, Twitter placeholder ⚠️
- Missing: Transcripts, OAuth flows, incremental updates ❌
- Action: Enhance YouTube with transcripts, implement Twitter OAuth

**Next Steps:**
1. Add refresh token to `auth_sessions` table
2. Create `/api/auth/refresh` endpoint
3. Update middleware to check revocation
4. Integrate youtube-transcript for YouTube
5. Implement Twitter OAuth flow

