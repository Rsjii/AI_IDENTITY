import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ErrorCodes } from '../../utils/errors';
import { handleErrorWithResponse } from '../../utils/errorHandler';
import { logger } from '../../config/logger';
import {
  createIdentity as createIdentityService,
  getIdentityByUserId,
  updateIdentityVersion as updateIdentityVersionService,
  generateMirrorReplyWithLogging,
  logTrustEvent,
  createNewIdentityVersion,
  activateIdentityVersionForUser,
  listIdentityVersionsForUser,
} from './identityService';

// Schemas
const createIdentitySchema = z.object({
  identityJson: z.object({
    displayName: z.string().min(1),
    primaryUse: z.string(),
    defaults: z.object({}).passthrough(),
    hardRules: z.object({}).passthrough(),
    boundaries: z.object({}).passthrough(),
    decisionPolicy: z.object({}).passthrough(),
    styleAnchors: z.object({}).passthrough(),
  }),
});

const updateIdentitySchema = z.object({
  identityJson: z.object({}).passthrough(),
});

// Contexts where the AI clone can be tested/used.
// 'web' is used by the dashboard Test AI tab (MirrorPage).
const mirrorSchema = z.object({
  context: z.enum(['linkedin_dm', 'email', 'sales', 'intro', 'support', 'personal', 'web']),
  incomingMessage: z.string().min(1),
});

const trustConfirmSchema = z.object({
  mirrorRunId: z.string(),
  event: z.enum(['confirm_yes', 'confirm_no', 'edit_rule', 'regenerate']),
  note: z.string().optional(),
});

const createVersionSchema = z.object({
  identityJson: z.object({}).passthrough(),
});

/**
 * POST /api/identity
 * Create identity + v1
 */
export const createIdentity = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
    }

    const { identityJson } = createIdentitySchema.parse(req.body);

    // Create identity using service
    const { identity, version } = await createIdentityService(req.user.id, identityJson);

    // ✅ ADD: advance onboarding step
    try {
      const { userQueries } = await import('../../config/database');
      await userQueries.updateOnboardingStep(req.user.id, 'content');
    } catch {}

    res.json({
      success: true,
      identity: {
        id: identity.id,
        activeVersionId: version.id,
      },
    });
  } catch (error: any) {
    logger.error('Create identity error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors,
      });
    }

    // Handle service errors
    if (error.message === 'Identity already exists. Use update to modify.') {
      return res.status(409).json({
        error: 'Identity already exists. Use PUT to update.',
        errorCode: ErrorCodes.CONFLICT,
      });
    }

    handleErrorWithResponse(error, res, 'Failed to create identity.');
  }
};

/**
 * GET /api/identity/me
 * Get current identity + active version
 */
export const getIdentity = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
    }

    // Get identity using service
    const result = await getIdentityByUserId(req.user.id);
    if (!result) {
      return res.status(404).json({
        error: 'Identity not found',
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    const { identity, activeVersion } = result;

    res.json({
      success: true,
      identity: {
        id: identity.id,
        activeVersionId: identity.activeVersionId,
        status: identity.status,
        activeVersion: activeVersion
          ? {
              id: activeVersion.id,
              version: activeVersion.version,
              status: activeVersion.status,
              identityJson: activeVersion.identityJson,
            }
          : null,
      },
    });
  } catch (error) {
    logger.error('Get identity error:', error);
    handleErrorWithResponse(error, res, 'Failed to get identity.');
  }
};

/**
 * PUT /api/identity/version/:id
 * Update identity version JSON
 */
export const updateIdentityVersion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
    }

    const versionId = req.params.id;
    const { identityJson } = updateIdentitySchema.parse(req.body);

    // Update using service (now creates new version instead of mutating)
    const result = await updateIdentityVersionService(versionId, req.user.id, identityJson);

    res.json({
      success: true,
      message: 'Identity updated successfully (new version created)',
      activeVersionId: result.activeVersionId,
      version: result.version,
    });
  } catch (error: any) {
    logger.error('Update identity version error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors,
      });
    }

    // Handle service errors
    if (error.message === 'Identity version not found') {
      return res.status(404).json({
        error: 'Identity version not found',
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    if (error.message === 'Access denied') {
      return res.status(403).json({
        error: 'Access denied',
        errorCode: ErrorCodes.FORBIDDEN,
      });
    }

    handleErrorWithResponse(error, res, 'Failed to update identity.');
  }
};

/**
 * POST /api/identity/version
 * Create NEW version (immutable) + activate
 */
export const createIdentityVersion = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
    }

    const { identityJson } = createVersionSchema.parse(req.body);
    const result = await createNewIdentityVersion(req.user.id, identityJson);

    return res.json({
      success: true,
      activeVersionId: result.version.id,
      version: result.version.version,
    });
  } catch (error: any) {
    logger.error('Create identity version error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors,
      });
    }

    if (error.message === 'Identity not found') {
      return res.status(404).json({
        error: error.message,
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    handleErrorWithResponse(error, res, 'Failed to create identity version.');
  }
};

/**
 * POST /api/identity/version/:id/activate
 * Activate an older version
 */
export const activateIdentityVersion = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
    }

    const versionId = req.params.id;
    await activateIdentityVersionForUser(req.user.id, versionId);

    return res.json({
      success: true,
      activeVersionId: versionId,
    });
  } catch (error: any) {
    logger.error('Activate identity version error:', error);

    if (error.message === 'Identity version not found') {
      return res.status(404).json({
        error: error.message,
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    if (error.message === 'Access denied') {
      return res.status(403).json({
        error: error.message,
        errorCode: ErrorCodes.FORBIDDEN,
      });
    }

    handleErrorWithResponse(error, res, 'Failed to activate identity version.');
  }
};

/**
 * GET /api/identity/versions
 * List all versions for current identity
 */
export const listIdentityVersions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
    }

    const result = await listIdentityVersionsForUser(req.user.id);
    return res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('List identity versions error:', error);

    if (error.message === 'Identity not found') {
      return res.status(404).json({
        error: error.message,
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    handleErrorWithResponse(error, res, 'Failed to list identity versions.');
  }
};

/**
 * POST /api/mirror
 * Generate mirror reply
 */
export const mirror = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
    }

    const { context, incomingMessage } = mirrorSchema.parse(req.body);

    // Generate mirror reply using service
    const result = await generateMirrorReplyWithLogging(
      req.user.id,
      context,
      incomingMessage
    );

    res.json({
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
    logger.error('Mirror error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors,
      });
    }

    // Handle service errors
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

    // ✅ Surface LLM configuration issues clearly
    const msg = String(error?.message || '');
    const msgLower = msg.toLowerCase();

    if (msgLower.includes('invalid api key') || msgLower.includes('invalid_api_key')) {
      return res.status(503).json({
        error: 'LLM configuration error (invalid API key). Fix GROQ_API_KEY / OPENAI_API_KEY in backend .env and restart server.',
        errorCode: 'LLM_AUTH_FAILED',
      });
    }

    if (msgLower.includes('no llm api key configured')) {
      return res.status(503).json({
        error: 'LLM not configured. Set GROQ_API_KEY / GROQ_API_KEY_ANONYMOUS or OPENAI_API_KEY in backend .env and restart server.',
        errorCode: 'LLM_NOT_CONFIGURED',
      });
    }

    if (msgLower.includes('openai') || msgLower.includes('groq api error') || msgLower.includes('all groq models failed')) {
      return res.status(503).json({
        error: 'LLM provider error. Please retry in a minute or check server logs.',
        errorCode: 'LLM_UPSTREAM_ERROR',
      });
    }

    handleErrorWithResponse(error, res, 'Failed to generate mirror reply.');
  }
};

/**
 * POST /api/trust/confirm
 * Log trust confirmation
 */
export const confirmTrust = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
    }

    const { mirrorRunId, event, note } = trustConfirmSchema.parse(req.body);

    // Log trust event using service
    await logTrustEvent(req.user.id, mirrorRunId, event, note);

    res.json({
      success: true,
      message: 'Trust event logged',
    });
  } catch (error: any) {
    logger.error('Confirm trust error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors,
      });
    }

    // Handle service errors
    if (error.message === 'Mirror run not found' ||
        error.message === 'Identity version not found') {
      return res.status(404).json({
        error: error.message,
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    if (error.message === 'Access denied') {
      return res.status(403).json({
        error: 'Access denied',
        errorCode: ErrorCodes.FORBIDDEN,
      });
    }

    handleErrorWithResponse(error, res, 'Failed to log trust event.');
  }
};

/**
 * GET /api/identity/training-status
 * Get training status for onboarding
 */
export const getTrainingStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
    }

    const { identityQueries, identityVersionQueries, db, userQueries } = await import('../../config/database');
    const identity = await identityQueries.findByUserId(req.user.id);
    
    if (!identity) {
      return res.json({
        status: 'not_started',
        progress: 0,
        message: 'Identity not created yet',
      });
    }

    if (!identity.activeVersionId) {
      return res.json({
        status: 'training',
        progress: 50,
        message: 'Creating identity version...',
      });
    }

    const version = await identityVersionQueries.findById(identity.activeVersionId);
    if (!version) {
      return res.json({
        status: 'training',
        progress: 75,
        message: 'Finalizing identity...',
      });
    }

    // If identity and version exist, training is complete
    // ✅ Send AI-ready email once (event-based idempotency)
    try {
      const sentCheck = await db.query(
        `SELECT 1 FROM "Event" WHERE "userId"=$1 AND "type"='ai_ready_email_sent' LIMIT 1`,
        [req.user.id]
      );
      if (!sentCheck.rows[0]) {
        const user = await userQueries.findById(req.user.id);
        if (user?.email) {
          const { EmailService } = await import('../auth/authService');
          const emailService = new EmailService();
          await emailService.sendAIReadyEmail(user.email, user.name || user.handle || 'Creator');
          await db.query(
            `INSERT INTO "Event" (id, "userId", "type", "meta") VALUES ($1, $2, $3, $4)`,
            [`evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, req.user.id, 'ai_ready_email_sent', JSON.stringify({ source: 'training_status' })]
          );
        }
      }
    } catch (err: any) {
      logger.warn('AI ready email send failed:', err?.message || err);
    }

    return res.json({
      status: 'ready',
      progress: 100,
      message: 'AI is ready!',
    });
  } catch (error: any) {
    logger.error('Get training status error:', error);
    return res.status(500).json({
      status: 'error',
      progress: 0,
      message: 'Failed to check training status',
    });
  }
};

