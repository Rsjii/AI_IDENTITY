import { uploadPublicBuffer } from '../../services/s3Service';
import { knowledgeSourceQueries, knowledgeChunkQueries } from '../../config/database';
import { logger } from '../../config/logger';
import { YoutubeTranscript } from 'youtube-transcript';
import { ensureTrainingJob } from '../../services/trainingJobService';

// PDF parsing
let pdfParse: any = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  logger.warn('pdf-parse not installed, PDF parsing disabled');
}

// Word parsing
let mammoth: any = null;
try {
  mammoth = require('mammoth');
} catch (e) {
  logger.warn('mammoth not installed, Word parsing disabled');
}

// OpenAI for Whisper transcription
let OpenAI: any = null;
let openaiClient: any = null;
try {
  OpenAI = require('openai');
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch (e) {
  logger.warn('openai not installed or configured, audio transcription disabled');
}

function chunkText(text: string, chunkSize = 1200): string[] {
  const clean = (text || '').trim();
  if (!clean) return [];
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += chunkSize) out.push(clean.slice(i, i + chunkSize));
  return out;
}

function looksLikeHtml(s: string): boolean {
  const t = (s || '').trim().slice(0, 2000).toLowerCase();
  return t.includes('<html') || t.includes('<body') || /<p[\s>]/.test(t) || /<div[\s>]/.test(t);
}

function stripHtmlToText(html: string): { title?: string; text: string } {
  const raw = html || '';
  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : undefined;

  // remove scripts/styles/noscript/svg
  let cleaned = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');

  // add newlines for block-ish tags to preserve structure
  cleaned = cleaned
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|blockquote|section|article|br)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  // strip remaining tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // basic entity decoding (minimal set)
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // normalize whitespace
  const text = cleaned
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return { title, text };
}

export async function createUrlSource(userId: string, url: string, title?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let rawText: string | undefined;
  let resolvedTitle: string | undefined = title;

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // reduce bot blocks a bit
        'User-Agent': 'SelflyxBot/1.0 (+local-dev)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
      },
    });

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const body = await res.text();

    if (contentType.includes('text/plain') && !looksLikeHtml(body)) {
      rawText = body.trim() || undefined;
    } else {
      const parsed = stripHtmlToText(body);
      resolvedTitle = resolvedTitle || parsed.title || url;
      rawText = parsed.text || undefined;
    }
  } catch (error: any) {
    logger.warn({ err: error, url }, '[Content] URL fetch/extract failed; storing URL only');
  } finally {
    clearTimeout(timeout);
  }

  const source = await knowledgeSourceQueries.create({
    userId,
    type: 'url',
    title: resolvedTitle || 'URL',
    originalUrl: url,
    rawText: rawText || undefined,
  });

  const chunks = rawText ? chunkText(rawText) : [];
  await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);

  // ✅ FIX: Only ensureTrainingJob (embeddings will be generated in background via training job)
  await ensureTrainingJob(userId);

  return source;
}

async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
  if (!openaiClient) {
    throw new Error('OpenAI API not configured for audio transcription');
  }
  try {
    const file = new (require('openai').FileFromBuffer)(buffer, 'audio', mimeType);
    const transcription = await openaiClient.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
    });
    return transcription.text || '';
  } catch (error: any) {
    try {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', buffer, { filename: 'audio', contentType: mimeType });
      form.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          ...form.getHeaders(),
        },
        body: form,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${errorText}`);
      }

      const result = await response.json() as { text?: string };
      return result.text || '';
    } catch (fallbackError: any) {
      logger.error({ error, fallbackError }, 'Whisper transcription failed');
      throw new Error(`Transcription failed: ${fallbackError.message || error.message}`);
    }
  }
}

async function getYouTubeTranscript(url: string): Promise<string> {
  // Extract video ID
  const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  if (!videoIdMatch) {
    throw new Error('Invalid YouTube URL');
  }
  const videoId = videoIdMatch[1];

  try {
    // Try to get transcript using youtube-transcript package
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    if (transcript && transcript.length > 0) {
      // Combine all transcript segments into one text
      const fullText = transcript.map(segment => segment.text).join(' ');
      logger.info(`Successfully transcribed YouTube video ${videoId}: ${fullText.length} characters`);
      return fullText;
    }

    logger.warn(`No transcript available for video ${videoId}`);
    return '';
  } catch (error: any) {
    // Handle specific error cases
    if (error.message?.includes('disabled') || error.message?.includes('Transcript is disabled')) {
      logger.warn(`Transcripts disabled for video ${videoId}`);
    } else if (error.message?.includes('not found') || error.message?.includes('Video not found')) {
      logger.warn(`Video not found: ${videoId}`);
    } else {
      logger.error({ error, videoId }, 'YouTube transcription failed');
    }

    // Return empty string - URL will still be stored
    return '';
  }
}

export async function createPasteSource(userId: string, title: string | undefined, rawText: string) {
  const source = await knowledgeSourceQueries.create({ userId, type: 'paste', title, rawText });
  const chunks = chunkText(rawText);
  await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);

  // ✅ FIX: Only ensureTrainingJob (embeddings will be generated in background via training job)
  await ensureTrainingJob(userId);

  return source;
}

export async function createYoutubeSource(userId: string, url: string, title?: string) {
  let transcribedText = '';
  try {
    transcribedText = await getYouTubeTranscript(url);
  } catch (error: any) {
    logger.warn({ error, url }, 'YouTube transcription failed, storing URL only');
  }

  const source = await knowledgeSourceQueries.create({
    userId,
    type: 'youtube',
    title: title || 'YouTube',
    originalUrl: url,
    rawText: transcribedText || undefined,
  });

  const chunks = transcribedText ? chunkText(transcribedText) : [];
  await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);

  // ✅ FIX: Only ensureTrainingJob (embeddings will be generated in background via training job)
  await ensureTrainingJob(userId);

  return source;
}

// Background processor: called after source record is already created.
// Does text extraction, S3 upload, chunking, and triggers training — all off the request path.
export async function processFileContent(userId: string, sourceId: string, file: Express.Multer.File) {
  try {
    let extractedText = '';
    const mimeType = file.mimetype || '';

    try {
      if (mimeType === 'application/pdf' && pdfParse) {
        const data = await pdfParse(file.buffer);
        extractedText = data.text || '';
      } else if ((mimeType.includes('word') || mimeType.includes('document') || file.originalname.endsWith('.docx')) && mammoth) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = result.value || '';
      } else if (mimeType.startsWith('text/')) {
        extractedText = file.buffer.toString('utf-8');
      } else if (mimeType.startsWith('audio/') && openaiClient) {
        extractedText = await transcribeAudio(file.buffer, mimeType);
      }
    } catch (error: any) {
      logger.warn({ error, mimeType, filename: file.originalname }, 'File parsing failed in background');
    }

    const upload = await uploadPublicBuffer({
      keyPrefix: `knowledge/${userId}/files`,
      contentType: file.mimetype || 'application/octet-stream',
      body: file.buffer,
      ext: (file.originalname.split('.').pop() || '').toLowerCase(),
    });

    await knowledgeSourceQueries.update(sourceId, {
      storageUrl: upload.url,
      rawText: extractedText || undefined,
    });

    const chunks = extractedText ? chunkText(extractedText) : [];
    await knowledgeChunkQueries.replaceForSource(userId, sourceId, chunks);

    await ensureTrainingJob(userId);
  } catch (err: any) {
    logger.error({ err, sourceId }, 'Background file processing failed');
  }
}

export async function createFileSource(userId: string, file: Express.Multer.File, title?: string) {
  let extractedText = '';
  const mimeType = file.mimetype || '';

  try {
    if (mimeType === 'application/pdf' && pdfParse) {
      const data = await pdfParse(file.buffer);
      extractedText = data.text || '';
    } else if ((mimeType.includes('word') || mimeType.includes('document') || file.originalname.endsWith('.docx')) && mammoth) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      extractedText = result.value || '';
    } else if (mimeType.startsWith('text/')) {
      extractedText = file.buffer.toString('utf-8');
    } else if (mimeType.startsWith('audio/') && openaiClient) {
      extractedText = await transcribeAudio(file.buffer, mimeType);
    }
  } catch (error: any) {
    logger.warn({ error, mimeType, filename: file.originalname }, 'File parsing/transcription failed, storing file only');
  }

  const upload = await uploadPublicBuffer({
    keyPrefix: `knowledge/${userId}/files`,
    contentType: file.mimetype || 'application/octet-stream',
    body: file.buffer,
    ext: (file.originalname.split('.').pop() || '').toLowerCase(),
  });

  const source = await knowledgeSourceQueries.create({
    userId,
    type: 'file',
    title: title || file.originalname,
    storageUrl: upload.url,
    rawText: extractedText || undefined,
    fetchMetadata: {
      mimeType: file.mimetype,
      bytes: file.size, // multer provides this
      originalName: file.originalname,
    },
  });

  const chunks = extractedText ? chunkText(extractedText) : [];
  await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);

  // ✅ FIX: Only ensureTrainingJob (embeddings will be generated in background via training job)
  await ensureTrainingJob(userId);

  return source;
}
