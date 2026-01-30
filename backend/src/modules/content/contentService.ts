import { uploadPublicBuffer } from '../../services/s3Service';
import { knowledgeSourceQueries, knowledgeChunkQueries } from '../../config/database';
import { logger } from '../../config/logger';
import { YoutubeTranscript } from 'youtube-transcript';
import { ragService } from '../../services/ragService';
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

  // Generate embeddings for RAG (async, don't block)
  ragService.generateEmbeddingsForUser(userId).catch(err => {
    logger.warn('[Content] Failed to generate embeddings:', err);
  });

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

  // Generate embeddings for RAG (async, don't block)
  if (chunks.length > 0) {
    ragService.generateEmbeddingsForUser(userId).catch(err => {
      logger.warn('[Content] Failed to generate embeddings:', err);
    });
  }

  await ensureTrainingJob(userId);

  return source;
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
  });

  const chunks = extractedText ? chunkText(extractedText) : [];
  await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);

  // Generate embeddings for RAG (async, don't block)
  if (chunks.length > 0) {
    ragService.generateEmbeddingsForUser(userId).catch(err => {
      logger.warn('[Content] Failed to generate embeddings:', err);
    });
  }

  await ensureTrainingJob(userId);

  return source;
}
