import { Router } from 'express';
import { widgetChat, widgetCode, getWidgetAnalytics } from './widgetController';
import { widgetChatRateLimit } from '../../middleware/rateLimit';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';

const router = Router();

// Public endpoints
router.post('/chat', widgetChatRateLimit, widgetChat);
// ✅ Public endpoint - no auth required for embed code
router.get('/code/:creatorId', widgetCode);

// Authenticated endpoint for analytics
router.get('/analytics', requireJWTFromCookie, getWidgetAnalytics);

export default router;

