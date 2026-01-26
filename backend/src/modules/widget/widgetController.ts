import { Request, Response } from 'express';
import { z } from 'zod';
import { detokenizeId } from '../../utils/idTokenization';
import { generateMirrorReplyWithLogging } from '../identity/identityService';
import { widgetChatLogQueries } from '../../config/database';

const chatSchema = z.object({
  creatorId: z.string().min(1), // tokenized preferred
  message: z.string().min(1),
});

export async function widgetChat(req: Request, res: Response) {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });

  const { creatorId, message } = parsed.data;

  // Accept tokenized id (v2....) OR raw id (dev)
  const detok = detokenizeId(creatorId, { endpoint: '/api/widget/chat' });
  const creatorUserId = detok?.id || creatorId;

  const result = await generateMirrorReplyWithLogging(creatorUserId, 'widget', message, { platform: 'api' });

  await widgetChatLogQueries.create(creatorUserId, null, message, result.reply || '');

  return res.json({
    success: true,
    reply: result.reply,
    mirrorRunId: result.mirrorRunId,
  });
}

export async function widgetCode(req: Request, res: Response) {
  const creatorId = String(req.params.creatorId || '');
  const apiBase = `${req.protocol}://${req.get('host')}`;

  // Returns copy-paste snippet
  return res.type('text/plain').send(
`<!-- Selflyx Widget -->
<link rel="stylesheet" href="${apiBase}/embed.css" />
<script src="${apiBase}/embed.js" data-api-base="${apiBase}" data-creator-id="${creatorId}"></script>`
  );
}

