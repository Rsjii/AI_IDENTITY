import { Router } from 'express';
import { widgetChat, widgetCode } from './widgetController';
import { widgetChatRateLimit } from '../../middleware/rateLimit';

const router = Router();

// Public
router.post('/chat', widgetChatRateLimit, widgetChat);
router.get('/code/:creatorId', widgetCode);

export default router;

