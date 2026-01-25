import { Router } from 'express';
import { z } from 'zod';
import { requireExtensionBearer, ExtensionAuthedRequest } from '../../middleware/extensionAuth';
import { generateMirrorReplyWithLogging } from '../identity/identityService';
import { logger } from '../../config/logger';
import { ErrorCodes } from '../../utils/errors';
import { handleErrorWithResponse } from '../../utils/errorHandler';

const router = Router();
router.use(requireExtensionBearer);

const extMirrorSchema = z.object({
  context: z.enum(['linkedin_dm', 'email', 'sales', 'intro', 'support', 'personal']),
  incomingMessage: z.string().min(1),
});

router.post('/mirror', async (req: ExtensionAuthedRequest, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', errorCode: 'UNAUTHORIZED' });
    }

    const { context, incomingMessage } = extMirrorSchema.parse(req.body);

    const result = await generateMirrorReplyWithLogging(userId, context, incomingMessage, { platform: 'gmail' });

    return res.json({
      success: true,
      decision: result.decision?.action || '',
      decisionReason: result.decisionReason || result.decision?.reason || '',
      reply: result.reply,
      rulesApplied: result.rulesApplied,
      mirrorRunId: result.mirrorRunId,
      validatorStatus: result.validatorStatus || undefined,
      validatorViolations: result.validatorViolations || [],
    });
  } catch (error: any) {
    logger.error('Extension mirror error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors,
      });
    }

    // Handle service errors (same as website mirror endpoint)
    if (error.message === 'Identity not found. Please create your identity first.' ||
        error.message === 'Active identity version not found') {
      return res.status(404).json({
        error: error.message,
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    if (error.message === 'Daily token quota exceeded. Try again tomorrow.') {
      return res.status(429).json({
        error: error.message,
        errorCode: 'TOKEN_QUOTA_EXCEEDED',
      });
    }

    handleErrorWithResponse(error, res, 'Failed to generate mirror reply.');
  }
});

const extTrustSchema = z.object({
  mirrorRunId: z.string().min(1),
  event: z.enum(['confirm_yes', 'confirm_no', 'edit_rule', 'regenerate']),
  note: z.string().optional(),
});

router.post('/trust/confirm', async (req: ExtensionAuthedRequest, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', errorCode: 'UNAUTHORIZED' });
    }

    const { mirrorRunId, event, note } = extTrustSchema.parse(req.body);
    const { logTrustEvent } = await import('../identity/identityService');

    await logTrustEvent(userId, mirrorRunId, event, note);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('Extension trust confirm error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors,
      });
    }

    handleErrorWithResponse(error, res, 'Failed to confirm trust.');
  }
});

router.get('/identity/active', async (req: ExtensionAuthedRequest, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', errorCode: 'UNAUTHORIZED' });
    }

    const { getIdentityByUserId } = await import('../identity/identityService');
    const out = await getIdentityByUserId(userId);

    if (!out?.activeVersion?.identityJson) {
      return res.json({ success: true, identity: null });
    }

    const j = out.activeVersion.identityJson;
    return res.json({
      success: true,
      identity: {
        displayName: j.displayName || 'User',
        primaryUse: j.primaryUse || '',
      },
    });
  } catch (error: any) {
    logger.error('Extension get identity error:', error);
    handleErrorWithResponse(error, res, 'Failed to get identity.');
  }
});

export default router;

