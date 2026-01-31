import { Request, Response } from 'express';
import { z } from 'zod';
import { knowledgeSourceQueries } from '../../config/database';
import { createPasteSource, createYoutubeSource, createFileSource, createUrlSource } from './contentService';
import { logger } from '../../config/logger';

function getUserId(req: Request): string | null {
  const u: any = (req as any).user;
  return u?.id || u?.userId || null;
}

const pasteSchema = z.object({
  title: z.string().optional(),
  text: z.string().min(10),
});

const youtubeSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
});

const urlSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
});

const socialYoutubeChannelSchema = z.object({
  channelUrl: z.string().url(),
});

const socialTwitterSchema = z.object({
  handle: z.string().min(1),
});

export async function paste(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { title, text } = pasteSchema.parse(req.body);
  const source = await createPasteSource(userId, title, text);
  return res.json({ success: true, source });
}

export async function youtube(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { url, title } = youtubeSchema.parse(req.body);
  const source = await createYoutubeSource(userId, url, title);
  return res.json({ success: true, source });
}

export async function url(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { url: inputUrl, title } = urlSchema.parse(req.body);
  const source = await createUrlSource(userId, inputUrl, title);
  return res.json({ success: true, source });
}

// Social imports with real API integration
// YouTube: Uses YouTube Data API v3 to fetch channel videos
// Twitter: Placeholder for future Twitter API integration

/**
 * Extract channel ID from URL (supports /channel/ and /@username formats)
 */
function extractChannelId(channelUrl: string, apiKey: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    let channelId = '';
    if (channelUrl.includes('/channel/')) {
      channelId = channelUrl.split('/channel/')[1].split('/')[0].split('?')[0];
      resolve(channelId);
    } else if (channelUrl.includes('/@')) {
      // Handle @username format - resolve to channel ID
      const username = channelUrl.split('/@')[1].split('/')[0].split('?')[0];
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(username)}&key=${apiKey}`;
      try {
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        if (searchData.items && searchData.items.length > 0) {
          channelId = searchData.items[0].id.channelId;
          resolve(channelId);
        } else {
          reject(new Error(`Channel not found: ${username}`));
        }
      } catch (error) {
        reject(error);
      }
    } else {
      reject(new Error('Invalid YouTube channel URL format'));
    }
  });
}

/**
 * Fetch all videos from a channel with pagination
 */
async function fetchAllYouTubeVideos(channelId: string, apiKey: string): Promise<any[]> {
  let allVideos: any[] = [];
  let nextPageToken: string | null = null;
  let pageCount = 0;
  const maxPages = 10; // Limit to 500 videos (50 per page)

  do {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&maxResults=50&order=date&key=${apiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      throw new Error(`YouTube API error: ${data.error.message}`);
    }

    if (data.items) {
      allVideos.push(...data.items);
    }

    nextPageToken = data.nextPageToken || null;
    pageCount++;
  } while (nextPageToken && pageCount < maxPages);

  return allVideos;
}

/**
 * Fetch video transcript (using unofficial method - youtube-transcript alternative)
 * Note: This is a simplified version. For production, use youtube-transcript npm package
 */
async function fetchVideoTranscript(videoId: string): Promise<string> {
  try {
    // Try to fetch captions using YouTube Data API (requires OAuth for private videos)
    // For now, return empty - can be enhanced with youtube-transcript library
    // const { YoutubeTranscript } = require('youtube-transcript');
    // const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    // return transcript.map((t: any) => t.text).join(' ');
    
    // Placeholder: Return empty for now (can be enhanced)
    return '';
  } catch (error) {
    // If transcript fetch fails, return empty
    return '';
  }
}

/**
 * Chunk text into smaller pieces (for RAG storage)
 */
function chunkText(text: string, options: { maxTokens?: number } = {}): string[] {
  const maxTokens = options.maxTokens || 800;
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentTokenCount = 0;

  for (const word of words) {
    const wordTokens = Math.ceil(word.length / 4); // Rough estimate: 4 chars = 1 token
    if (currentTokenCount + wordTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [word];
      currentTokenCount = wordTokens;
    } else {
      currentChunk.push(word);
      currentTokenCount += wordTokens;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

async function fetchYouTubeChannelVideos(channelUrl: string, apiKey?: string): Promise<{ content: string; videos: any[] }> {
  if (!apiKey) {
    throw new Error('YouTube API key not configured. Set YOUTUBE_API_KEY in environment variables.');
  }

  // Extract channel ID
  const channelId = await extractChannelId(channelUrl, apiKey);

  // Fetch all videos with pagination
  const videos = await fetchAllYouTubeVideos(channelId, apiKey);

  if (videos.length === 0) {
    return { content: `YouTube Channel: ${channelUrl}\n\nNo videos found.`, videos: [] };
  }

  // Aggregate video metadata
  const contentParts = videos.map((item: any) => {
    const title = item.snippet.title || '';
    const description = item.snippet.description || '';
    const publishedAt = item.snippet.publishedAt || '';
    const videoId = item.id.videoId || '';
    return `Video: ${title}\nVideo ID: ${videoId}\nPublished: ${publishedAt}\nDescription: ${description}\n`;
  });

  const content = `YouTube Channel: ${channelUrl}\n\nTotal Videos: ${videos.length}\n\nVideos:\n\n${contentParts.join('\n---\n\n')}`;

  return { content, videos };
}

export async function importYoutubeChannel(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { channelUrl } = socialYoutubeChannelSchema.parse(req.body);
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;

  try {
    // Fetch channel content with pagination
    const { content, videos } = await fetchYouTubeChannelVideos(channelUrl, youtubeApiKey);

    // ✅ NEW: Check for existing source (incremental updates)
    const existingSources = await knowledgeSourceQueries.listByUserId(userId);
    const existingSource = existingSources.find(s => s.originalUrl === channelUrl && (s.type === 'url' || s.type === 'youtube'));

    let source;
    if (existingSource) {
      // Update existing source
      await knowledgeSourceQueries.update(existingSource.id, {
        rawText: content,
        lastFetchedAt: new Date(),
        fetchMetadata: { videosCount: videos.length, lastFetch: new Date().toISOString(), previousCount: existingSource.fetchMetadata?.videosCount || 0 }
      });
      source = { ...existingSource, rawText: content };
    } else {
      // Create new knowledge source
      source = await knowledgeSourceQueries.create({
        userId,
        type: 'url',
        title: 'YouTube Channel',
        originalUrl: channelUrl,
        storageUrl: undefined,
        rawText: content,
      });
      // Update with fetch metadata
      await knowledgeSourceQueries.update(source.id, {
        lastFetchedAt: new Date(),
        fetchMetadata: { videosCount: videos.length, firstFetch: new Date().toISOString() }
      });
    }

    // ✅ NEW: Store video metadata in knowledge_chunks for better RAG
    const { knowledgeChunkQueries } = await import('../../config/database');
    const chunks: string[] = [];
    
    // Chunk each video's content (limit to first 100 to avoid timeout)
    for (const video of videos.slice(0, 100)) {
      const title = video.snippet.title || '';
      const description = video.snippet.description || '';
      const videoContent = `Video Title: ${title}\nDescription: ${description}`;
      const videoChunks = chunkText(videoContent, { maxTokens: 500 });
      chunks.push(...videoChunks);
    }

    // Store chunks
    if (chunks.length > 0) {
      await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);
    }

    const isUpdate = !!existingSource;
    return res.json({
      success: true,
      source,
      message: `YouTube channel ${isUpdate ? 'updated' : 'imported'} successfully! ${videos.length} videos processed, ${chunks.length} chunks created.`,
      stats: {
        videosCount: videos.length,
        chunksCount: chunks.length,
        isUpdate,
      }
    });
  } catch (error: any) {
    // Fallback: save URL only if API fails
    const source = await knowledgeSourceQueries.create({
      userId,
      type: 'url',
      title: 'YouTube Channel',
      originalUrl: channelUrl,
      storageUrl: undefined,
      rawText: undefined,
    });

    return res.json({
      success: true,
      source,
      message: `YouTube channel URL saved. API import failed: ${error.message}. You can configure YOUTUBE_API_KEY to enable automatic content import.`,
    });
  }
}

async function fetchTwitterProfile(handle: string, apiKey?: string): Promise<{ content: string; tweets: any[] }> {
  const clean = handle.replace(/^@/, '').trim();

  if (!apiKey) {
    return {
      content: `Twitter Profile: @${clean}\n\nTo enable Twitter import:\n- Configure TWITTER_BEARER_TOKEN (Twitter/X API v2)\n- Or use OAuth flow (Connect button)\n\nNote: Twitter API access depends on your app tier and permissions.`,
      tweets: [],
    };
  }

  // Best-effort v2 public fetch with bearer token
  // 1) Resolve username -> user id
  const userRes = await fetch(`https://api.twitter.com/2/users/by/username/${encodeURIComponent(clean)}?user.fields=created_at,public_metrics`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const userJson: any = await userRes.json().catch(() => ({}));
  if (!userRes.ok || !userJson?.data?.id) {
    const msg = userJson?.error?.message || userJson?.title || userJson?.detail || `Failed to resolve Twitter username @${clean}`;
    throw new Error(msg);
  }

  const twitterUserId = userJson.data.id as string;

  // 2) Fetch latest tweets (limit 50)
  const tweetsRes = await fetch(
    `https://api.twitter.com/2/users/${encodeURIComponent(twitterUserId)}/tweets?max_results=50&tweet.fields=created_at,public_metrics,text&exclude=retweets,replies`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  const tweetsJson: any = await tweetsRes.json().catch(() => ({}));
  if (!tweetsRes.ok) {
    const msg = tweetsJson?.error?.message || tweetsJson?.title || tweetsJson?.detail || `Failed to fetch tweets for @${clean}`;
    throw new Error(msg);
  }

  const tweets = Array.isArray(tweetsJson?.data) ? tweetsJson.data : [];
  const content = [
    `Twitter Profile: @${clean}`,
    '',
    ...tweets.map((t: any) => `Tweet: ${t.text}\nDate: ${t.created_at || ''}\nLikes: ${t.public_metrics?.like_count || 0}\n`),
  ].join('\n---\n\n');

  return { content, tweets };
}

export async function importTwitterHandle(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { handle } = socialTwitterSchema.parse(req.body);
  const twitterBearerToken = process.env.TWITTER_BEARER_TOKEN;

  const profileUrl = `https://twitter.com/${handle.replace(/^@/, '')}`;

  try {
    // Fetch Twitter content using API
    const { content, tweets } = await fetchTwitterProfile(handle, twitterBearerToken);

    // ✅ NEW: Check for existing source (incremental updates)
    const existingSources = await knowledgeSourceQueries.listByUserId(userId);
    const existingSource = existingSources.find(s => s.originalUrl === profileUrl && (s.type === 'url' || s.type === 'twitter'));

    let source;
    if (existingSource) {
      // Update existing source
      await knowledgeSourceQueries.update(existingSource.id, {
        rawText: content,
        lastFetchedAt: new Date(),
        fetchMetadata: { tweetsCount: tweets.length, lastFetch: new Date().toISOString(), previousCount: existingSource.fetchMetadata?.tweetsCount || 0 }
      });
      source = { ...existingSource, rawText: content };
    } else {
      // Create new knowledge source
      source = await knowledgeSourceQueries.create({
        userId,
        type: 'url',
        title: 'Twitter Profile',
        originalUrl: profileUrl,
        storageUrl: undefined,
        rawText: content,
      });
      // Update with fetch metadata
      await knowledgeSourceQueries.update(source.id, {
        lastFetchedAt: new Date(),
        fetchMetadata: { tweetsCount: tweets.length, firstFetch: new Date().toISOString() }
      });
    }

    // ✅ NEW: Store tweets in knowledge_chunks for better RAG
    if (tweets.length > 0) {
      const { knowledgeChunkQueries } = await import('../../config/database');
      const chunks: string[] = [];
      
      // Chunk each tweet's content
      for (const tweet of tweets) {
        const text = tweet.text || '';
        const tweetChunks = chunkText(text, { maxTokens: 300 }); // Smaller chunks for tweets
        chunks.push(...tweetChunks);
      }

      // Store chunks
      if (chunks.length > 0) {
        await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);
      }

      return res.json({
        success: true,
        source,
        message: `Twitter profile imported successfully! ${tweets.length} tweets processed, ${chunks.length} chunks created.`,
        stats: {
          tweetsCount: tweets.length,
          chunksCount: chunks.length,
        }
      });
    }

    return res.json({
      success: true,
      source,
      message: `Twitter profile saved. ${twitterBearerToken ? 'No tweets found or API limit reached.' : 'Configure TWITTER_BEARER_TOKEN to enable automatic content import.'}`,
    });
  } catch (error: any) {
    // Fallback: save URL only
    const source = await knowledgeSourceQueries.create({
      userId,
      type: 'url',
      title: 'Twitter Profile',
      originalUrl: profileUrl,
      storageUrl: undefined,
      rawText: undefined,
    });

    return res.json({
      success: true,
      source,
      message: `Twitter profile URL saved. API import failed: ${error.message}. ${twitterBearerToken ? 'Check your Twitter API credentials and rate limits.' : 'Configure TWITTER_BEARER_TOKEN to enable automatic content import.'}`,
    });
  }
}

export async function upload(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'No file provided' });

  try {
    // ✅ Enhanced file validation using sanitizer
    const { validateFileUpload } = await import('../../middleware/sanitizer');
    
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-m4a',
      'audio/mp4',
    ];
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.mp3', '.wav', '.m4a'];
    
    const validation = validateFileUpload(file, {
      maxSize: 25 * 1024 * 1024, // 25MB (reduced from 50MB for security)
      allowedMimeTypes,
      allowedExtensions,
    });
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const title = String((req as any).body?.title || '').trim() || undefined;
    
    // ✅ Upload to S3 with error handling
    const source = await createFileSource(userId, file, title);
    
    return res.json({
      success: true,
      source,
      message: 'File uploaded successfully. Processing embeddings...',
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Upload error');
    
    // ✅ User-friendly error messages
    if (error.message?.includes('S3') || error.message?.includes('upload')) {
      return res.status(500).json({ error: 'File upload failed. Please try again.' });
    }
    
    if (error.message?.includes('parse') || error.message?.includes('extract')) {
      return res.status(500).json({ error: 'Failed to extract text from file.' });
    }
    
    return res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
}

export async function list(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const items = await knowledgeSourceQueries.listByUserId(userId);

  // ADD: helpers
  const safeParseMeta = (v: any): any => {
    if (!v) return {};
    if (typeof v === 'object') return v;
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return {}; }
    }
    return {};
  };

  const countWords = (t: string): number => {
    const s = (t || '').trim();
    if (!s) return 0;
    return s.split(/\s+/).filter(Boolean).length;
  };

  const inferMimeFromTitle = (title: string): string | undefined => {
    const lower = (title || '').toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.doc')) return 'application/msword';
    if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (lower.endsWith('.txt')) return 'text/plain';
    if (lower.endsWith('.md')) return 'text/markdown';
    if (lower.endsWith('.csv')) return 'text/csv';
    if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return undefined;
  };

  // CHANGE: enrich items for frontend stats
  const enriched = items.map((it: any) => {
    const meta = safeParseMeta(it.fetchMetadata);
    const rawText = it.rawText || '';

    const wordCount = countWords(rawText);

    // Prefer real file bytes, else fallback to rawText bytes (so 0 na rahe)
    const size =
      (typeof meta.bytes === 'number' && meta.bytes > 0)
        ? meta.bytes
        : (rawText ? Buffer.byteLength(rawText, 'utf8') : 0);

    const mimeType =
      (typeof meta.mimeType === 'string' && meta.mimeType)
        ? meta.mimeType
        : (it.type === 'file' ? inferMimeFromTitle(it.title || '') : undefined);

    // IMPORTANT: frontend categorization expects mime-like strings
    const typeForUi = mimeType || it.type;

    return {
      ...it,
      type: typeForUi,
      size,
      wordCount,
    };
  });

  return res.json({ success: true, items: enriched });
}

export async function remove(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const id = String(req.params.id || '');
  await knowledgeSourceQueries.deleteByIdForUser(userId, id);
  return res.json({ success: true });
}