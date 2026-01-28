/**
 * Response Cache Service - Caches LLM responses for common queries
 *
 * Massive cost savings potential:
 * - 100 users ask "What's your morning routine?"
 * - First user: $0.005 (LLM call)
 * - Next 99 users: $0 (cached)
 * - Total saved: $0.495 (99x cheaper!)
 *
 * Cache Strategy:
 * 1. Normalize query (lowercase, trim, remove extra spaces)
 * 2. Hash query + user identity version ID (cache per identity)
 * 3. Store response with TTL (1 hour default)
 * 4. Optional: Semantic similarity for fuzzy matching
 */

import crypto from 'crypto';
import { logger } from '../config/logger';
import { embeddingService } from './embeddingService';

export interface CacheEntry {
  response: string;
  timestamp: number;
  tokensUsed: number;
  model: string;
  hitCount: number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: string;
  memorySizeEstimate: string;
}

class ResponseCacheService {
  // Primary cache: exact match
  private exactCache: Map<string, CacheEntry> = new Map();

  // Semantic cache: similar queries (optional, more advanced)
  private semanticCache: Map<string, {
    embedding: number[];
    response: string;
    timestamp: number;
    query: string;
  }> = new Map();

  // Stats
  private stats = {
    hits: 0,
    misses: 0,
  };

  // Config
  private readonly TTL_MS = 60 * 60 * 1000; // 1 hour cache TTL
  private readonly MAX_CACHE_SIZE = 5000; // Max cached responses
  private readonly SEMANTIC_SIMILARITY_THRESHOLD = 0.92; // Very high similarity required
  private readonly SEMANTIC_CACHE_SIZE = 500;

  /**
   * Get cached response for a query
   * Returns null if not cached or expired
   */
  async get(
    userId: string,
    identityVersionId: string,
    query: string,
    options: { useSemanticCache?: boolean } = {}
  ): Promise<CacheEntry | null> {
    const cacheKey = this.buildCacheKey(userId, identityVersionId, query);

    // 1. Check exact match cache
    const exact = this.exactCache.get(cacheKey);
    if (exact) {
      // Check if expired
      if (Date.now() - exact.timestamp < this.TTL_MS) {
        exact.hitCount++;
        this.stats.hits++;
        logger.debug(`[Cache] HIT (exact): ${cacheKey.substring(0, 16)}...`);
        return exact;
      } else {
        // Expired, remove
        this.exactCache.delete(cacheKey);
      }
    }

    // 2. Optional: Check semantic cache
    if (options.useSemanticCache && embeddingService.isOpenAIAvailable()) {
      const semanticMatch = await this.findSemanticMatch(userId, identityVersionId, query);
      if (semanticMatch) {
        this.stats.hits++;
        logger.debug(`[Cache] HIT (semantic): similar to "${semanticMatch.query.substring(0, 30)}..."`);
        return {
          response: semanticMatch.response,
          timestamp: semanticMatch.timestamp,
          tokensUsed: 0,
          model: 'cache-semantic',
          hitCount: 1,
        };
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Store response in cache
   */
  async set(
    userId: string,
    identityVersionId: string,
    query: string,
    response: string,
    tokensUsed: number,
    model: string,
    options: { addToSemanticCache?: boolean } = {}
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(userId, identityVersionId, query);

    // Evict if at capacity
    if (this.exactCache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    // Store in exact cache
    this.exactCache.set(cacheKey, {
      response,
      timestamp: Date.now(),
      tokensUsed,
      model,
      hitCount: 0,
    });

    // Optionally add to semantic cache
    if (options.addToSemanticCache && embeddingService.isOpenAIAvailable()) {
      await this.addToSemanticCache(userId, identityVersionId, query, response);
    }

    logger.debug(`[Cache] SET: ${cacheKey.substring(0, 16)}...`);
  }

  /**
   * Invalidate cache for a user (call when identity changes)
   */
  invalidateUser(userId: string): void {
    let removed = 0;

    // Remove from exact cache
    for (const key of this.exactCache.keys()) {
      if (key.startsWith(userId)) {
        this.exactCache.delete(key);
        removed++;
      }
    }

    // Remove from semantic cache
    for (const key of this.semanticCache.keys()) {
      if (key.startsWith(userId)) {
        this.semanticCache.delete(key);
        removed++;
      }
    }

    logger.info(`[Cache] Invalidated ${removed} entries for user ${userId}`);
  }

  /**
   * Invalidate specific identity version
   */
  invalidateIdentityVersion(identityVersionId: string): void {
    let removed = 0;

    for (const key of this.exactCache.keys()) {
      if (key.includes(identityVersionId)) {
        this.exactCache.delete(key);
        removed++;
      }
    }

    for (const key of this.semanticCache.keys()) {
      if (key.includes(identityVersionId)) {
        this.semanticCache.delete(key);
        removed++;
      }
    }

    logger.info(`[Cache] Invalidated ${removed} entries for identity version ${identityVersionId}`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : '0.00';

    // Estimate memory size
    let memoryBytes = 0;
    for (const entry of this.exactCache.values()) {
      memoryBytes += entry.response.length * 2; // UTF-16
    }
    for (const entry of this.semanticCache.values()) {
      memoryBytes += entry.response.length * 2;
      memoryBytes += entry.embedding.length * 8; // Float64
    }

    const memorySizeMB = (memoryBytes / (1024 * 1024)).toFixed(2);

    return {
      totalEntries: this.exactCache.size + this.semanticCache.size,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate: `${hitRate}%`,
      memorySizeEstimate: `${memorySizeMB} MB`,
    };
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.exactCache.clear();
    this.semanticCache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
    logger.info('[Cache] All caches cleared');
  }

  /**
   * Build cache key from components
   */
  private buildCacheKey(userId: string, identityVersionId: string, query: string): string {
    const normalizedQuery = this.normalizeQuery(query);
    return crypto
      .createHash('md5')
      .update(`${userId}:${identityVersionId}:${normalizedQuery}`)
      .digest('hex');
  }

  /**
   * Normalize query for consistent caching
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s?]/g, ''); // Remove punctuation except ?
  }

  /**
   * Evict oldest cache entries
   */
  private evictOldest(): void {
    // Sort by timestamp and remove oldest 10%
    const entries = Array.from(this.exactCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.exactCache.delete(entries[i][0]);
    }

    logger.debug(`[Cache] Evicted ${toRemove} oldest entries`);
  }

  /**
   * Find semantically similar cached query
   */
  private async findSemanticMatch(
    userId: string,
    identityVersionId: string,
    query: string
  ): Promise<{ query: string; response: string; timestamp: number } | null> {
    const keyPrefix = `${userId}:${identityVersionId}:`;

    // Get query embedding
    const queryEmbedding = await embeddingService.generateEmbedding(query);

    let bestMatch: { query: string; response: string; timestamp: number; similarity: number } | null = null;

    for (const [key, entry] of this.semanticCache) {
      if (!key.startsWith(keyPrefix)) continue;

      // Check if expired
      if (Date.now() - entry.timestamp >= this.TTL_MS) {
        this.semanticCache.delete(key);
        continue;
      }

      const similarity = embeddingService.cosineSimilarity(
        queryEmbedding.embedding,
        entry.embedding
      );

      if (similarity >= this.SEMANTIC_SIMILARITY_THRESHOLD) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = {
            query: entry.query,
            response: entry.response,
            timestamp: entry.timestamp,
            similarity,
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Add entry to semantic cache
   */
  private async addToSemanticCache(
    userId: string,
    identityVersionId: string,
    query: string,
    response: string
  ): Promise<void> {
    // Limit semantic cache size
    if (this.semanticCache.size >= this.SEMANTIC_CACHE_SIZE) {
      // Remove oldest
      const oldest = Array.from(this.semanticCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) {
        this.semanticCache.delete(oldest[0]);
      }
    }

    try {
      const embedding = await embeddingService.generateEmbedding(query);
      const key = `${userId}:${identityVersionId}:${crypto.createHash('md5').update(query).digest('hex')}`;

      this.semanticCache.set(key, {
        embedding: embedding.embedding,
        response,
        timestamp: Date.now(),
        query,
      });
    } catch (error: any) {
      logger.debug('[Cache] Failed to add to semantic cache:', error.message);
    }
  }
}

export const responseCacheService = new ResponseCacheService();
