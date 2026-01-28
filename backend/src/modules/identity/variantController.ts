/**
 * A/B Testing Variant Controller
 * Handles HTTP requests for variant management
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../../config/logger';
import * as variantService from './variantService';
import { asyncHandler } from '../../middleware/errorHandler';

const createVariantSchema = z.object({
  baseVersionId: z.string().min(1),
  variantName: z.string().min(1).max(50),
});

const updateWeightSchema = z.object({
  versionId: z.string().min(1),
  weight: z.number().int().min(0).max(100),
});

const toggleStatusSchema = z.object({
  versionId: z.string().min(1),
  status: z.enum(['active', 'paused']),
});

/**
 * POST /api/identity/variants/create
 * Create a new variant group
 */
export const createVariant = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { baseVersionId, variantName } = createVariantSchema.parse(req.body);

  const result = await variantService.createVariantGroup(
    req.user.id,
    baseVersionId,
    variantName
  );

  return res.json({
    success: true,
    variantGroupId: result.variantGroupId,
    variantVersionId: result.variantVersionId,
  });
});

/**
 * GET /api/identity/variants/:variantGroupId
 * Get variant group details
 */
export const getVariantGroup = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { variantGroupId } = req.params;
  const group = await variantService.getVariantGroup(req.user.id, variantGroupId);

  if (!group) {
    return res.status(404).json({ error: 'Variant group not found' });
  }

  return res.json({
    success: true,
    group,
  });
});

/**
 * GET /api/identity/variants/:variantGroupId/metrics
 * Get metrics for all variants in a group
 */
export const getVariantMetrics = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { variantGroupId } = req.params;
  const metrics = await variantService.getVariantMetrics(req.user.id, variantGroupId);

  return res.json({
    success: true,
    metrics,
  });
});

/**
 * POST /api/identity/variants/update-weight
 * Update variant weight
 */
export const updateVariantWeight = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { versionId, weight } = updateWeightSchema.parse(req.body);

  await variantService.updateVariantWeight(req.user.id, versionId, weight);

  return res.json({
    success: true,
    message: 'Variant weight updated',
  });
});

/**
 * POST /api/identity/variants/toggle-status
 * Pause or resume a variant
 */
export const toggleVariantStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { versionId, status } = toggleStatusSchema.parse(req.body);

  await variantService.toggleVariantStatus(req.user.id, versionId, status);

  return res.json({
    success: true,
    message: `Variant ${status === 'active' ? 'activated' : 'paused'}`,
  });
});

/**
 * GET /api/identity/variants/list
 * List all variant groups for user
 */
export const listVariantGroups = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { db, identityQueries } = await import('../../config/database');
  
  // Get all variant groups for user
  const result = await db.query(
    `SELECT DISTINCT iv."variantGroupId", iv."createdAt"
     FROM "identity_versions" iv
     JOIN "identities" i ON i.id = iv."identityId"
     WHERE i."userId" = $1 AND iv."variantGroupId" IS NOT NULL
     ORDER BY iv."createdAt" DESC`,
    [req.user.id]
  );

  const groups = await Promise.all(
    result.rows.map(async (row: any) => {
      const group = await variantService.getVariantGroup(req.user!.id, row.variantGroupId);
      return group;
    })
  );

  return res.json({
    success: true,
    groups: groups.filter(g => g !== null),
  });
});

