import { Request, Response } from 'express';
import { z } from 'zod';
import { userQueries, chatSessionQueries, chatMessageQueries, db } from '../../config/database';
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
      welcomeMessage: (u.priceConfig as any)?.welcomeMessage || null,
      popularQuestions: (u.priceConfig as any)?.popularQuestions || [],
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

  // Check if user exceeded free tier
  const FREE_MESSAGE_LIMIT = 3;
  const sessionMessages = await chatMessageQueries.countBySession(sid);

  // Save user message
  await chatMessageQueries.add({ sessionId: sid, role: 'user', content: message });

  // Check payment requirement
  if (sessionMessages >= FREE_MESSAGE_LIMIT) {
    // ✅ Check if payment already made for this session
    const paidResult = await db.query(
      `SELECT 1 FROM "stripe_payments"
       WHERE "sessionId"=$1 AND "status"='succeeded' AND "type"='pay_per_chat'
       ORDER BY "createdAt" DESC
       LIMIT 1`,
      [sid]
    );
    
    if (paidResult.rowCount > 0) {
      // Payment already made, unlock full reply
      const result = await generateMirrorReplyWithLogging(u.id, 'public_chat', message, {
        platform: 'web',
        sessionId: sid,
        visitorId,
      });
      if (result.reply) {
        await chatMessageQueries.add({ sessionId: sid, role: 'assistant', content: result.reply });
      }
      return res.json({
        success: true,
        sessionId: sid,
        reply: result.reply || '',
        decision: result.decision,
        mirrorRunId: result.mirrorRunId,
      });
    }

    // No payment, show paywall
    const pricing = u.priceConfig || { premium: { amountCents: 500 }, vip: { amountCents: 5000 } };

    // Generate reply but don't return full content
    const result = await generateMirrorReplyWithLogging(u.id, 'public_chat', message, {
      platform: 'web',
      sessionId: sid,
      visitorId,
    });

    return res.json({
      success: true,
      requiresPayment: true,
      sessionId: sid,
      paymentOptions: {
        premium: { amount: pricing.premium?.amountCents || 500, label: 'Detailed Answer' },
        vip: { amount: pricing.vip?.amountCents || 5000, label: 'Full Consultation' },
      },
      previewReply: result.reply?.substring(0, 100) + '...',
      decision: result.decision,
      mirrorRunId: result.mirrorRunId,
    });
  }

  // mirror + save messages via identityService opts
  const result = await generateMirrorReplyWithLogging(u.id, 'public_chat', message, {
    platform: 'web',
    sessionId: sid,
    visitorId,
  });

  // Save assistant reply
  if (result.reply) {
    await chatMessageQueries.add({ sessionId: sid, role: 'assistant', content: result.reply });
  }

  return res.json({
    success: true,
    sessionId: sid,
    reply: result.reply || '',
    decision: result.decision,
    mirrorRunId: result.mirrorRunId,
  });
}