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

const mirrorSchema = z.object({
  context: z.enum(['linkedin_dm', 'email', 'sales', 'intro', 'support', 'personal']),
  incomingMessage: z.string().min(1),
});

const trustConfirmSchema = z.object({
  mirrorRunId: z.string(),
  event: z.enum(['confirm_yes', 'confirm_no', 'edit_rule', 'regenerate']),
  note: z.string().optional(),
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

    // Update using service
    await updateIdentityVersionService(versionId, req.user.id, identityJson);

    res.json({
      success: true,
      message: 'Identity updated successfully',
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
      decision: result.decision,
      reply: result.reply,
      rulesApplied: result.rulesApplied,
      mirrorRunId: result.mirrorRunId,
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

