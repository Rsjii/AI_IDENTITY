/**
 * Query Result Caching Service
 * Caches database query results to reduce database load
 */

import { logger } from '../config/logger';
import crypto from 'crypto';

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 5 minutes)
  key?: string; // Custom cache key (optional)
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class QueryCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000; // Max cached entries

  /**
   * Generate cache key from query and params
   */
  private generateKey(query: string, params?: any[]): string {
    const paramsStr = params ? JSON.stringify(params) : '';
    const combined = `${query}:${paramsStr}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Get cached result
   */
  get<T>(query: string, params?: any[], options?: CacheOptions): T | null {
    const key = options?.key || this.generateKey(query, params);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    logger.debug(`[QueryCache] HIT: ${key.substring(0, 16)}...`);
    return entry.data as T;
  }

  /**
   * Set cache entry
   */
  set<T>(query: string, data: T, params?: any[], options?: CacheOptions): void {
    const key = options?.key || this.generateKey(query, params);
    const ttl = options?.ttl || this.DEFAULT_TTL;

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    logger.debug(`[QueryCache] SET: ${key.substring(0, 16)}... (TTL: ${ttl}ms)`);
  }

  /**
   * Invalidate cache by pattern or all
   */
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      logger.debug('[QueryCache] Cleared all entries');
      return;
    }

    // Remove entries matching pattern
    let removed = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        removed++;
      }
    }

    logger.debug(`[QueryCache] Invalidated ${removed} entries matching pattern: ${pattern}`);
  }

  /**
   * Evict oldest entries (LRU-like)
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, timestamp: entry.timestamp }))
      .sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest 10% of entries
    const toRemove = Math.max(1, Math.floor(this.cache.size * 0.1));
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i].key);
    }

    logger.debug(`[QueryCache] Evicted ${toRemove} oldest entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: string;
  } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: 'N/A', // Would need to track hits/misses
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug(`[QueryCache] Cleaned ${removed} expired entries`);
    }
  }
}

// Singleton instance
export const queryCache = new QueryCacheService();

// Clean expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    queryCache.cleanExpired();
  }, 5 * 60 * 1000);
}

