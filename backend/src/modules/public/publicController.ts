import { Request, Response } from 'express';
import { z } from 'zod';
import { userQueries, chatSessionQueries, chatMessageQueries } from '../../config/database';
import { generateMirrorReplyWithLogging } from '../identity/identityService';

const chatSchema = z.object({
  slug: z.string().min(1),
  message: z.string().min(1),
  visitorId: z.string().optional(),
  sessionId: z.string().optional(),
});

export async function getCreator(req: Request, res: Response) {
  const slug = String(req.params.slug || '').trim();
  const u = await userQueries.findBySlugOrHandle(slug);
  if (!u) return res.status(404).json({ error: 'Creator not found' });

  return res.json({
    success: true,
    creator: {
      slug: u.publicSlug || u.handle,
      displayName: u.name || u.handle || 'Creator',
      avatarUrl: u.profileImage || null,
      priceConfig: u.priceConfig || null,
      creatorTitle: u.creatorTitle || null,
      creatorTags: u.creatorTags || null,
    },
  });
}

export async function publicChat(req: Request, res: Response) {
  const { slug, message, visitorId, sessionId } = chatSchema.parse(req.body);

  const u = await userQueries.findBySlugOrHandle(slug);
  if (!u) return res.status(404).json({ error: 'Creator not found' });

  // session: reuse if provided else create
  let sid = sessionId || null;
  if (!sid) {
    const s = await chatSessionQueries.create({
      creatorId: u.id,
      visitorId: visitorId || null,
      userId: null,
      platform: 'web',
    });
    sid = s.id;
  }

  // mirror + save messages via identityService opts
  const result = await generateMirrorReplyWithLogging(u.id, 'public_chat', message, {
    platform: 'web',
    sessionId: sid,
    visitorId,
  });

  return res.json({
    success: true,
    sessionId: sid,
    reply: result.reply || '',
    decision: result.decision,
    mirrorRunId: result.mirrorRunId,
  });
}