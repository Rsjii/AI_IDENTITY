/**
 * File Management Routes
 * Routes for file listing, deletion, and storage management
 */

import express from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import {
  listFiles,
  getStorageUsage,
  deleteFile
} from './fileManagementController';

const router = express.Router();

// All routes require authentication
router.use(requireJWTFromCookie);

/**
 * GET /api/creator/files
 * List all files uploaded by the creator
 */
router.get('/files', listFiles);

/**
 * GET /api/creator/storage
 * Get storage usage statistics
 */
router.get('/storage', getStorageUsage);

/**
 * DELETE /api/creator/files/:id?type=voice|video
 * Delete a file and update storage quota
 */
router.delete('/files/:id', deleteFile);

export default router;
