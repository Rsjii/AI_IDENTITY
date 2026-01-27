import { Response } from 'express';
import { z } from 'zod';
import { logger } from '../../config/logger';
import { ErrorCodes } from '../../utils/errors';
import { handleErrorWithResponse } from '../../utils/errorHandler';
import { generateMirrorReplyWithLogging } from './identityService';
import { generateVoiceAudio } from '../voice/voiceService';

const mirrorVoiceSchema = z.object({
  context: z.enum(['linkedin_dm', 'email', 'sales', 'intro', 'support', 'personal']),
  incomingMessage: z.string().min(1),
  voiceId: z.string().min(1), // voice_clones.id
});

export async function mirrorVoice(req: any, res: Response) {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required', errorCode: ErrorCodes.UNAUTHORIZED });
    }

    const { context, incomingMessage, voiceId } = mirrorVoiceSchema.parse(req.body);

    const result = await generateMirrorReplyWithLogging(userId, context, incomingMessage, { platform: 'web' });

    // If decision isn't "reply", don't generate audio
    const decisionAction = result.decision?.action || '';
    let audioUrl: string | null = null;

    if (decisionAction === 'reply' && result.reply?.trim()) {
      audioUrl = await generateVoiceAudio(userId, voiceId, result.reply);
    }

    return res.json({
      success: true,
      decision: result.decision?.action || '',
      decisionReason: result.decisionReason || result.decision?.reason || '',
      reply: result.reply,
      mirrorRunId: result.mirrorRunId,
      audioUrl,
      validatorStatus: result.validatorStatus || undefined,
      validatorViolations: result.validatorViolations || [],
    });
  } catch (error: any) {
    logger.error('Mirror voice error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', errorCode: ErrorCodes.VALIDATION_ERROR, details: error.errors });
    }
    handleErrorWithResponse(error, res, 'Failed to generate mirror voice reply.');
  }
}



