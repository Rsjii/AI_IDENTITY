import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middleware/auth';
import { createError, ErrorCodes } from '../../utils/errors';
import { handleErrorWithResponse } from '../../utils/errorHandler';
import { logger } from '../../config/logger';
import {
  identityQueries,
  identityVersionQueries,
  mirrorRunQueries,
  trustEventQueries,
} from '../../config/database';
import { generateMirrorReply } from './identityService';
import { llmClient } from '../../services/llmClient';

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

    // Check if identity already exists
    const existing = await identityQueries.findByUserId(req.user.id);
    if (existing) {
      return res.status(409).json({
        error: 'Identity already exists. Use PUT to update.',
        errorCode: ErrorCodes.CONFLICT,
      });
    }

    // Create identity
    const identity = await identityQueries.create(req.user.id);

    // Create v1
    const version = await identityVersionQueries.create(identity.id, 'v1', identityJson);

    // Activate v1
    await identityVersionQueries.updateStatus(version.id, 'active');
    await identityQueries.updateActiveVersion(identity.id, version.id);

    logger.info(`Identity created for user ${req.user.id}`);

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

    const identity = await identityQueries.findByUserId(req.user.id);
    if (!identity) {
      return res.status(404).json({
        error: 'Identity not found',
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    // Get active version
    let activeVersion = null;
    if (identity.activeVersionId) {
      activeVersion = await identityVersionQueries.findById(identity.activeVersionId);
      if (activeVersion && typeof activeVersion.identityJson === 'string') {
        activeVersion.identityJson = JSON.parse(activeVersion.identityJson);
      }
    }

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

    // Verify version exists and belongs to user
    const version = await identityVersionQueries.findById(versionId);
    if (!version) {
      return res.status(404).json({
        error: 'Identity version not found',
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    const identity = await identityQueries.findById(version.identityId);
    if (!identity || identity.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        errorCode: ErrorCodes.FORBIDDEN,
      });
    }

    // Update
    await identityVersionQueries.updateIdentityJson(versionId, identityJson);

    logger.info(`Identity version ${versionId} updated`);

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

    // Get identity
    const identity = await identityQueries.findByUserId(req.user.id);
    if (!identity || !identity.activeVersionId) {
      return res.status(404).json({
        error: 'Identity not found. Please create your identity first.',
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    // Get active version
    const version = await identityVersionQueries.findById(identity.activeVersionId);
    if (!version) {
      return res.status(404).json({
        error: 'Active identity version not found',
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    // Parse identity JSON
    let identityJson: any;
    if (typeof version.identityJson === 'string') {
      identityJson = JSON.parse(version.identityJson);
    } else {
      identityJson = version.identityJson;
    }

    // Generate reply
    const startTime = Date.now();
    const { reply, rulesApplied } = await generateMirrorReply(identityJson, incomingMessage, context);
    const latencyMs = Date.now() - startTime;

    // Get token usage from llmClient (if available)
    // Note: llmClient doesn't expose last usage, so we'll log it separately
    const model = 'gpt-4o-mini'; // Default, actual model comes from llmClient

    // Save mirror run
    const mirrorRun = await mirrorRunQueries.create(
      version.id,
      context,
      incomingMessage,
      reply,
      rulesApplied,
      model,
      undefined, // tokensIn - would need to track
      undefined, // tokensOut - would need to track
    );

    logger.info(`Mirror run created: ${mirrorRun.id}`);

    res.json({
      success: true,
      reply,
      rulesApplied,
      mirrorRunId: mirrorRun.id,
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

    // Verify mirror run exists and belongs to user
    const mirrorRun = await mirrorRunQueries.findById(mirrorRunId);
    if (!mirrorRun) {
      return res.status(404).json({
        error: 'Mirror run not found',
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    // Verify version belongs to user
    const version = await identityVersionQueries.findById(mirrorRun.identityVersionId);
    if (!version) {
      return res.status(404).json({
        error: 'Identity version not found',
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    const identity = await identityQueries.findById(version.identityId);
    if (!identity || identity.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        errorCode: ErrorCodes.FORBIDDEN,
      });
    }

    // Create trust event
    await trustEventQueries.create(mirrorRunId, version.id, event, note);

    logger.info(`Trust event logged: ${event} for mirror run ${mirrorRunId}`);

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

    handleErrorWithResponse(error, res, 'Failed to log trust event.');
  }
};

