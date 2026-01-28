/**
 * Performance Monitoring Middleware
 * 
 * Tracks API latency per route and logs slow requests
 * Can be extended to track LLM latency, DB query times, etc.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { db } from '../config/database';
import os from 'os';

// Alert thresholds (in milliseconds)
const SLOW_REQUEST_THRESHOLD = 2000; // 2 seconds
const VERY_SLOW_REQUEST_THRESHOLD = 5000; // 5 seconds
const P95_TARGET = 1000; // 1 second for p95
const EMAIL_ALERT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes per route/method
const LATENCY_RETENTION_DAYS = 30; // keep last 30 days of api latency events

interface PerformanceMetrics {
  route: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: Date;
}

// In-memory metrics (in production, use Redis or time-series DB)
const metrics: PerformanceMetrics[] = [];
const MAX_METRICS = 10000; // Keep last 10k requests

// In-memory throttle for email alerts to avoid spam
const lastEmailAlertAtByRoute = new Map<string, number>();

function isApiPath(path: string) {
  return path.startsWith('/api/');
}

function generateLatencyId() {
  return `apl_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function getSystemStats() {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  return {
    node: {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
      arrayBuffers: (mem as any).arrayBuffers ?? undefined,
    },
    os: {
      platform: os.platform(),
      arch: os.arch(),
      uptimeSec: os.uptime(),
      loadavg: os.loadavg(),
      cpuCount: os.cpus()?.length || 0,
      totalMem,
      freeMem,
      usedMem: totalMem - freeMem,
    },
  };
}

export function performanceMonitor(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const route = req.route?.path || req.path;
  const method = req.method;

  // Track response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Store metric
    metrics.push({
      route,
      method,
      duration,
      statusCode,
      timestamp: new Date(),
    });

    // Keep only last MAX_METRICS
    if (metrics.length > MAX_METRICS) {
      metrics.shift();
    }

    // Alert on slow requests
    if (duration >= VERY_SLOW_REQUEST_THRESHOLD) {
      logger.error({
        route,
        method,
        duration,
        statusCode,
        threshold: 'VERY_SLOW',
      }, `🚨 VERY SLOW REQUEST: ${method} ${route} took ${duration}ms`);
    } else if (duration >= SLOW_REQUEST_THRESHOLD) {
      logger.warn({
        route,
        method,
        duration,
        statusCode,
        threshold: 'SLOW',
      }, `⚠️ SLOW REQUEST: ${method} ${route} took ${duration}ms`);
    }

    // ✅ A2: Persist API latency events to database (for admin p50/p95/p99)
    // Keep scope to /api routes to reduce noise.
    if (isApiPath(req.path)) {
      const id = generateLatencyId();
      void db.query(
        `
          INSERT INTO "api_latency_events" (id, route, method, "statusCode", "durationMs")
          VALUES ($1, $2, $3, $4, $5)
        `,
        [id, route, method, statusCode, duration]
      ).catch((e: any) => {
        logger.debug({ err: String(e) }, 'Failed to persist api_latency_events');
      });

      // ✅ A2: Email alerting for latency > 5s (throttled)
      if (duration >= VERY_SLOW_REQUEST_THRESHOLD) {
        const key = `${method} ${route}`;
        const now = Date.now();
        const last = lastEmailAlertAtByRoute.get(key) || 0;
        if (now - last >= EMAIL_ALERT_COOLDOWN_MS) {
          lastEmailAlertAtByRoute.set(key, now);
          void (async () => {
            try {
              const { EmailService } = await import('../modules/auth/authService');
              const emailService = new EmailService();
              const adminEmail = process.env['ADMIN_EMAIL'] || process.env['SUPPORT_EMAIL'];
              if (!adminEmail) return;

              await emailService.sendEmail(
                adminEmail,
                `⚠️ Latency Alert: ${method} ${route} (${duration}ms)`,
                `
                  <h2>Latency Alert</h2>
                  <p><strong>Route:</strong> ${method} ${route}</p>
                  <p><strong>Status:</strong> ${statusCode}</p>
                  <p><strong>Duration:</strong> ${duration}ms</p>
                  <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                  <p><strong>Host:</strong> ${os.hostname()}</p>
                  <p><a href="${process.env['APP_URL'] || 'https://selflyx.com'}/admin">Open Admin Dashboard</a></p>
                `
              );
            } catch {
              // ignore
            }
          })();
        }
      }
    }
  });

  next();
}

/**
 * Get performance statistics for a route or all routes
 */
export function getPerformanceStats(route?: string): {
  count: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  slowCount: number;
} {
  let filtered = metrics;
  if (route) {
    filtered = metrics.filter(m => m.route === route || m.method + ' ' + m.route === route);
  }

  if (filtered.length === 0) {
    return {
      count: 0,
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      max: 0,
      slowCount: 0,
    };
  }

  const durations = filtered.map(m => m.duration).sort((a, b) => a - b);
  const count = durations.length;
  const avg = durations.reduce((a, b) => a + b, 0) / count;
  const p50 = durations[Math.floor(count * 0.5)];
  const p95 = durations[Math.floor(count * 0.95)];
  const p99 = durations[Math.floor(count * 0.99)];
  const max = durations[count - 1];
  const slowCount = filtered.filter(m => m.duration >= SLOW_REQUEST_THRESHOLD).length;

  return { count, avg, p50, p95, p99, max, slowCount };
}

/**
 * Get top slowest routes
 */
export function getSlowestRoutes(limit: number = 10): Array<{
  route: string;
  method: string;
  avgDuration: number;
  maxDuration: number;
  count: number;
}> {
  const routeMap = new Map<string, { durations: number[]; method: string }>();

  metrics.forEach(m => {
    const key = `${m.method} ${m.route}`;
    if (!routeMap.has(key)) {
      routeMap.set(key, { durations: [], method: m.method });
    }
    routeMap.get(key)!.durations.push(m.duration);
  });

  const routes = Array.from(routeMap.entries()).map(([route, data]) => ({
    route,
    method: data.method,
    avgDuration: data.durations.reduce((a, b) => a + b, 0) / data.durations.length,
    maxDuration: Math.max(...data.durations),
    count: data.durations.length,
  }));

  return routes.sort((a, b) => b.avgDuration - a.avgDuration).slice(0, limit);
}

/**
 * Check if p95 exceeds target and alert
 */
export function checkPerformanceAlerts(): void {
  const stats = getPerformanceStats();
  if (stats.p95 > P95_TARGET && stats.count > 100) {
    logger.warn({
      p95: stats.p95,
      target: P95_TARGET,
      count: stats.count,
    }, `⚠️ PERFORMANCE ALERT: p95 latency (${stats.p95}ms) exceeds target (${P95_TARGET}ms)`);
  }
}

// Run performance check every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(checkPerformanceAlerts, 5 * 60 * 1000);
}

/**
 * ✅ A2: System stats helper (CPU/memory) for admin dashboard
 */
export function getSystemPerformanceStats() {
  return getSystemStats();
}

/**
 * ✅ A2: Retention cleanup for api_latency_events (best-effort)
 */
async function cleanupOldLatencyEvents() {
  const cutoff = new Date(Date.now() - LATENCY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    await db.query(`DELETE FROM "api_latency_events" WHERE "createdAt" < $1`, [cutoff]);
  } catch (e: any) {
    logger.debug({ err: String(e) }, 'Failed to cleanup api_latency_events');
  }
}

// Run cleanup daily (best-effort)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    void cleanupOldLatencyEvents();
  }, 24 * 60 * 60 * 1000);
}

