/**
 * Performance Monitoring Middleware
 * 
 * Tracks API latency per route and logs slow requests
 * Can be extended to track LLM latency, DB query times, etc.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { db } from '../config/database';

// Alert thresholds (in milliseconds)
const SLOW_REQUEST_THRESHOLD = 2000; // 2 seconds
const VERY_SLOW_REQUEST_THRESHOLD = 5000; // 5 seconds
const P95_TARGET = 1000; // 1 second for p95

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

