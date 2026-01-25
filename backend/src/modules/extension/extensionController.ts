import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ErrorCodes } from '../../utils/errors';
import { handleErrorWithResponse } from '../../utils/errorHandler';
import { logger } from '../../config/logger';
import { createExtensionToken, listExtensionTokens, revokeExtensionToken } from './extensionService';

const createTokenSchema = z.object({
  label: z.string().max(100).optional(),
});

export async function createToken(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', errorCode: ErrorCodes.UNAUTHORIZED });
    }

    const { label } = createTokenSchema.parse(req.body || {});
    const out = await createExtensionToken(req.user.id, label);

    return res.json({ success: true, ...out });
  } catch (error: any) {
    logger.error('Create extension token error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        errorCode: ErrorCodes.VALIDATION_ERROR,
        details: error.errors,
      });
    }

    handleErrorWithResponse(error, res, 'Failed to create extension token.');
  }
}

export async function listTokens(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', errorCode: ErrorCodes.UNAUTHORIZED });
    }

    const rows = await listExtensionTokens(req.user.id);
    return res.json({ success: true, rows });
  } catch (error: any) {
    logger.error('List extension tokens error:', error);
    handleErrorWithResponse(error, res, 'Failed to list extension tokens.');
  }
}

export async function revokeToken(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', errorCode: ErrorCodes.UNAUTHORIZED });
    }

    const tokenId = String(req.params.id || '');
    if (!tokenId) {
      return res.status(400).json({ error: 'token id required', errorCode: ErrorCodes.VALIDATION_ERROR });
    }

    await revokeExtensionToken(req.user.id, tokenId);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error('Revoke extension token error:', error);

    if (error.message === 'Token not found or already revoked') {
      return res.status(404).json({
        error: error.message,
        errorCode: ErrorCodes.NOT_FOUND,
      });
    }

    handleErrorWithResponse(error, res, 'Failed to revoke extension token.');
  }
}


