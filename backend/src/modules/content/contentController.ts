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