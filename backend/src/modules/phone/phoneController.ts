import { Request, Response } from 'express';
import { z } from 'zod';
import { generateMirrorReplyWithLogging } from '../identity/identityService';
import { db } from '../../config/database';
import { findUserByPhoneNumber, getPhoneIntegration, logPhoneCall, savePhoneConnection } from './phoneService';

function getUserId(req: Request): string | null {
  return req.user?.id || req.user?.userId || null;
}

const connectSchema = z.object({
  phoneNumber: z.string().min(10).max(20),
});

export async function connectPhone(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid phone number' });

  let phoneNumber = parsed.data.phoneNumber;
  if (!phoneNumber.startsWith('+')) phoneNumber = `+${phoneNumber}`;

  await savePhoneConnection(userId, phoneNumber);
  return res.json({ success: true, phoneNumber });
}

export async function phoneStatus(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const integration = await getPhoneIntegration(userId);
  if (!integration) return res.json({ connected: false });

  return res.json({
    connected: true,
    phoneNumber: integration.config?.phoneNumber || null,
    status: integration.status,
  });
}

export async function disconnectPhone(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  await db.query(
    `UPDATE "platform_integrations" SET "status"='disconnected', "updatedAt"=now()
     WHERE "userId"=$1 AND "platform"='phone'`,
    [userId]
  );
  return res.json({ success: true });
}

export async function phoneWebhook(req: Request, res: Response) {
  const from = String(req.body?.From || '');
  const to = String(req.body?.To || '');
  const callSid = String(req.body?.CallSid || '');

  const integration = await findUserByPhoneNumber(to.replace('whatsapp:', '').replace('tel:', '').trim());
  if (!integration) {
    return res.type('text/xml').send('<Response><Say>No active phone integration.</Say></Response>');
  }

  const userId = integration.userId;
  const greeting = 'Hello! This is your AI assistant. Please ask your question after the tone.';

  await logPhoneCall({
    userId,
    callerNumber: from,
    callSid,
  });

  const responseXml = `
    <Response>
      <Say>${greeting}</Say>
    </Response>
  `.trim();

  return res.type('text/xml').send(responseXml);
}

export async function handlePhoneMessage(req: Request, res: Response) {
  const { from, message } = req.body || {};
  if (!from || !message) return res.status(400).json({ error: 'Missing from or message' });

  const integration = await findUserByPhoneNumber(String(from));
  if (!integration) return res.status(404).json({ error: 'No phone integration found' });

  const result = await generateMirrorReplyWithLogging(integration.userId, 'phone', String(message), {
    platform: 'phone',
    visitorId: String(from),
  });

  return res.json({ reply: result.reply || '' });
}

