import { Request, Response } from 'express';
import { z } from 'zod';
import { knowledgeSourceQueries } from '../../config/database';
import { createPasteSource, createYoutubeSource, createFileSource } from './contentService';

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

// Social imports with real API integration
// YouTube: Uses YouTube Data API v3 to fetch channel videos
// Twitter: Placeholder for future Twitter API integration

async function fetchYouTubeChannelVideos(channelUrl: string, apiKey?: string): Promise<string> {
  if (!apiKey) {
    throw new Error('YouTube API key not configured. Set YOUTUBE_API_KEY in environment variables.');
  }

  // Extract channel ID from URL
  let channelId = '';
  if (channelUrl.includes('/channel/')) {
    channelId = channelUrl.split('/channel/')[1].split('/')[0].split('?')[0];
  } else if (channelUrl.includes('/@')) {
    // Handle @username format - need to resolve to channel ID
    const username = channelUrl.split('/@')[1].split('/')[0].split('?')[0];
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(username)}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    if (searchData.items && searchData.items.length > 0) {
      channelId = searchData.items[0].id.channelId;
    } else {
      throw new Error(`Channel not found: ${username}`);
    }
  } else {
    throw new Error('Invalid YouTube channel URL format');
  }

  // Fetch channel videos (latest 50)
  const videosUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&maxResults=50&order=date&key=${apiKey}`;
  const videosRes = await fetch(videosUrl);
  const videosData = await videosRes.json();

  if (!videosData.items || videosData.items.length === 0) {
    return `YouTube Channel: ${channelUrl}\n\nNo videos found.`;
  }

  // Aggregate video titles and descriptions
  const content = videosData.items.map((item: any) => {
    const title = item.snippet.title || '';
    const description = item.snippet.description || '';
    const publishedAt = item.snippet.publishedAt || '';
    return `Video: ${title}\nPublished: ${publishedAt}\nDescription: ${description}\n`;
  }).join('\n---\n\n');

  return `YouTube Channel: ${channelUrl}\n\nVideos:\n\n${content}`;
}

export async function importYoutubeChannel(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { channelUrl } = socialYoutubeChannelSchema.parse(req.body);
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;

  try {
    // Fetch channel content
    const rawText = await fetchYouTubeChannelVideos(channelUrl, youtubeApiKey);

    const source = await knowledgeSourceQueries.create({
      userId,
      type: 'url',
      title: 'YouTube Channel',
      originalUrl: channelUrl,
      storageUrl: undefined,
      rawText,
    });

    return res.json({
      success: true,
      source,
      message: `YouTube channel imported successfully! ${rawText.split('\n').length} lines of content added.`,
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

async function fetchTwitterProfile(handle: string, apiKey?: string): Promise<string> {
  // Twitter API v2 requires OAuth 2.0 and is more complex
  // For now, return a placeholder that can be extended
  if (!apiKey) {
    return `Twitter Profile: @${handle}\n\nTwitter API integration requires OAuth 2.0 setup. This is a placeholder for future implementation.\n\nTo enable Twitter import:\n1. Create a Twitter Developer account\n2. Set up OAuth 2.0 credentials\n3. Configure TWITTER_BEARER_TOKEN in environment variables\n4. Implement Twitter API v2 endpoints`;
  }

  // Placeholder for future Twitter API v2 implementation
  // const tweetsUrl = `https://api.twitter.com/2/tweets/search/recent?query=from:${handle}&max_results=100`;
  // const tweetsRes = await fetch(tweetsUrl, {
  //   headers: { Authorization: `Bearer ${apiKey}` }
  // });
  // const tweetsData = await tweetsRes.json();
  // ... process tweets

  return `Twitter Profile: @${handle}\n\nTwitter API integration coming soon.`;
}

export async function importTwitterHandle(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { handle } = socialTwitterSchema.parse(req.body);
  const twitterBearerToken = process.env.TWITTER_BEARER_TOKEN;

  const profileUrl = `https://twitter.com/${handle.replace(/^@/, '')}`;

  try {
    // Fetch Twitter content (placeholder for now)
    const rawText = await fetchTwitterProfile(handle, twitterBearerToken);

    const source = await knowledgeSourceQueries.create({
      userId,
      type: 'url',
      title: 'Twitter Profile',
      originalUrl: profileUrl,
      storageUrl: undefined,
      rawText,
    });

    return res.json({
      success: true,
      source,
      message: `Twitter profile saved. ${twitterBearerToken ? 'API integration coming soon.' : 'Configure TWITTER_BEARER_TOKEN to enable automatic content import.'}`,
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
      message: `Twitter profile URL saved. API import failed: ${error.message}`,
    });
  }
}

export async function upload(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'No file provided' });

  // Validate file type
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

  const fileExt = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
  const isValidMime = allowedMimeTypes.includes(file.mimetype);
  const isValidExt = allowedExtensions.includes(fileExt);

  if (!isValidMime && !isValidExt) {
    return res.status(400).json({
      error: 'Unsupported file type. Allowed: PDF, Word, Text, MP3, WAV, M4A',
    });
  }

  // Check file size (50MB limit)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    return res.status(400).json({ error: 'File size exceeds 50MB limit' });
  }

  const title = String((req as any).body?.title || '').trim() || undefined;
  const source = await createFileSource(userId, file, title);
  return res.json({ success: true, source });
}

export async function list(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const items = await knowledgeSourceQueries.listByUserId(userId);
  return res.json({ success: true, items });
}

export async function remove(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const id = String(req.params.id || '');
  await knowledgeSourceQueries.deleteByIdForUser(userId, id);
  return res.json({ success: true });
}