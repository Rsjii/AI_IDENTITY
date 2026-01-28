import { Request, Response } from 'express';
import {
  adminOverview,
  listUsers,
  getUserDetail,
  getErrorLogs,
  getPerformanceMetrics,
  getBusinessMetrics,
  logError
} from './adminDao';
import { getPerformanceStats, getSlowestRoutes } from '../../middleware/performanceMonitor';

function parseRange(req: Request) {
  const r = String(req.query.range || '7d');
  if (r === 'today' || r === '7d' || r === '30d' || r === '90d') return r;
  return '7d';
}

export async function overview(req: Request, res: Response) {
  const range = parseRange(req);
  const data = await adminOverview(range);
  return res.json({ success: true, data });
}

export async function users(req: Request, res: Response) {
  const range = parseRange(req);
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const data = await listUsers(range, q);
  return res.json({ success: true, ...data });
}

export async function userDetail(req: Request, res: Response) {
  const { userId } = req.params as any;
  const data = await getUserDetail(userId);
  return res.json({ success: true, data });
}

/**
 * A1: Error Tracking & Logging Endpoint
 * GET /api/admin/errors
 */
export async function errors(req: Request, res: Response) {
  const range = parseRange(req);
  const severity = typeof req.query.severity === 'string' ? req.query.severity : undefined;
  const limit = parseInt(String(req.query.limit || '100'), 10);

  const data = await getErrorLogs(range, severity, limit);
  return res.json({ success: true, data });
}

/**
 * A1: Log Error Endpoint (for frontend error reporting)
 * POST /api/admin/errors/log
 */
export async function logErrorEndpoint(req: Request, res: Response) {
  const { message, stack, source, severity, userId, meta } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  await logError({
    message,
    stack,
    source: source || 'frontend',
    severity: severity || 'error',
    userId: userId || (req as any).user?.id,
    meta
  });

  return res.json({ success: true });
}

/**
 * A2: Performance Monitoring Endpoint
 * GET /api/admin/performance
 */
export async function performance(req: Request, res: Response) {
  const range = parseRange(req);
  const route = typeof req.query.route === 'string' ? req.query.route : undefined;

  // Get in-memory performance stats
  const realtimeStats = getPerformanceStats(route);
  const slowestRoutes = getSlowestRoutes(10);

  // Get historical performance from database
  const historicalStats = await getPerformanceMetrics(range);

  return res.json({
    success: true,
    data: {
      realtime: {
        overall: realtimeStats,
        slowestRoutes
      },
      historical: historicalStats
    }
  });
}

/**
 * A3: Business Metrics Dashboard Endpoint
 * GET /api/admin/business-metrics
 */
export async function businessMetrics(req: Request, res: Response) {
  const range = parseRange(req);
  const data = await getBusinessMetrics(range);
  return res.json({ success: true, data });
}
