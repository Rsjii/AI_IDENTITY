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