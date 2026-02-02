import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import {
  getUserConversations,
  getSessionStats,
  updateConversation,
  deleteConversation,
  exportConversation,
  getUserSpendingStats,
  exportUserSpendingCSV,
  checkMessageLimit,
} from './conversationsController';

const router = Router();

// All routes require authentication
router.use(requireJWTFromCookie);

// Get all user conversations with filters
router.get('/', asyncHandler(getUserConversations));

// Get spending statistics
router.get('/spending-stats', asyncHandler(getUserSpendingStats));

// Export spending as CSV
router.get('/spending-export', asyncHandler(exportUserSpendingCSV));

// Get session statistics
router.get('/:sessionId/stats', asyncHandler(getSessionStats));

// Check message limit for session
router.get('/:sessionId/message-limit', asyncHandler(checkMessageLimit));

// Update conversation (favorite, archive, title)
router.patch('/:sessionId', asyncHandler(updateConversation));

// Delete conversation
router.delete('/:sessionId', asyncHandler(deleteConversation));

// Export conversation
router.get('/:sessionId/export', asyncHandler(exportConversation));

export default router;
