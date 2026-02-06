/**
 * RAG (Retrieval-Augmented Generation) Service
 *
 * Retrieves only relevant knowledge chunks based on semantic similarity
 * This is THE KEY optimization - we only send relevant context to LLM, not all data!
 *
 * Cost Impact:
 * - Without RAG: Send ALL 5000 tokens of knowledge = $0.052/query
 * - With RAG: Send only 300-500 relevant tokens = $0.005/query
 * - 10x cost reduction!
 */

import { db } from '../config/database';
import { logger } from '../config/logger';
import { embeddingService } from './embeddingService';

export interface KnowledgeChunk {
  id: string;
  sourceId: string;
  content: string;
  chunkIndex: number;
  embedding?: number[];
}

export interface RetrievedContext {
  chunks: Array<{
    id: string;
    content: string;
    similarity: number;
    sourceId: string;
  }>;
  totalTokensEstimate: number;
  retrievalTimeMs: number;
}

class RAGService {
  // Cache for user knowledge embeddings (refreshed periodically)
  private userKnowledgeCache: Map<string, {
    chunks: KnowledgeChunk[];
    lastRefreshed: number;
  }> = new Map();

  private cacheExpireMs = 5 * 60 * 1000; // 5 minutes

  /**
   * Retrieve relevant knowledge chunks for a query
   * This is the main RAG function - called on every chat
   */
  async retrieveRelevantContext(
    userId: string,
    query: string,
    options: {
      maxChunks?: number;
      maxTokens?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<RetrievedContext> {
    const startTime = Date.now();
    const {
      maxChunks = 5,
      maxTokens = 800, // Limit context to ~800 tokens
      minSimilarity = 0.3,
    } = options;

    try {
      logger.info({
        step: 'RAG_1_START',
        userId,
        queryLength: query.length,
        queryPreview: query.substring(0, 100),
        maxChunks,
        maxTokens,
        minSimilarity,
      }, '[RAG] 🔍 Starting RAG retrieval');

      // 1. Get user's knowledge chunks with embeddings
      const chunks = await this.getUserKnowledgeChunks(userId);

      logger.info({
        step: 'RAG_2_CHUNKS_LOADED',
        userId,
        totalChunks: chunks.length,
        chunksWithEmbeddings: chunks.filter(c => c.embedding && c.embedding.length > 0).length,
        chunksWithoutEmbeddings: chunks.filter(c => !c.embedding || c.embedding.length === 0).length,
      }, '[RAG] 📚 Knowledge chunks loaded from database');

      if (chunks.length === 0) {
        logger.warn({
          step: 'RAG_3_NO_CHUNKS',
          userId,
        }, '[RAG] ⚠️ No knowledge chunks found for user');
        return {
          chunks: [],
          totalTokensEstimate: 0,
          retrievalTimeMs: Date.now() - startTime,
        };
      }

      // 2. Generate embedding for query
      logger.info({
        step: 'RAG_4_GENERATING_QUERY_EMBEDDING',
        userId,
        queryLength: query.length,
      }, '[RAG] 🔢 Generating embedding for user query');

      const queryEmbedding = await embeddingService.generateEmbedding(query);

      logger.info({
        step: 'RAG_5_QUERY_EMBEDDING_GENERATED',
        userId,
        embeddingDimensions: queryEmbedding.embedding.length,
        model: queryEmbedding.model,
        tokensUsed: queryEmbedding.tokensUsed,
        cost: queryEmbedding.cost,
      }, '[RAG] ✅ Query embedding generated');

      // 3. Find most similar chunks
      const chunksWithEmbeddings = chunks.filter(c => c.embedding && c.embedding.length > 0);

      if (chunksWithEmbeddings.length === 0) {
        // No embeddings yet - fall back to keyword matching
        logger.debug('[RAG] No embeddings found, using keyword fallback');
        return this.keywordFallbackSearch(chunks, query, maxChunks, maxTokens, startTime);
      }

      logger.info({
        step: 'RAG_6_FINDING_SIMILAR_CHUNKS',
        userId,
        candidateChunks: chunksWithEmbeddings.length,
        minSimilarity,
      }, '[RAG] 🔎 Finding similar chunks using cosine similarity');

      const similar = embeddingService.findTopKSimilar(
        queryEmbedding.embedding,
        chunksWithEmbeddings.map(c => ({
          id: c.id,
          embedding: c.embedding!,
          content: c.content,
        })),
        maxChunks * 2, // Get more, then trim by tokens
        minSimilarity
      );

      logger.info({
        step: 'RAG_7_SIMILARITY_SEARCH_COMPLETE',
        userId,
        similarChunksFound: similar.length,
        topSimilarities: similar.slice(0, 5).map(s => ({
          similarity: s.similarity.toFixed(3),
          contentPreview: s.content.substring(0, 80),
        })),
      }, '[RAG] ✅ Similarity search complete');

      // If semantic similarity finds nothing (common with fallback embeddings),
      // gracefully fall back to keyword-based search so we still return context.
      if (similar.length === 0) {
        logger.warn({
          step: 'RAG_7_NO_SIMILAR_RESULTS',
          userId,
          model: queryEmbedding.model,
          reason: 'no semantic matches above minSimilarity; using keyword fallback',
        }, '[RAG] ⚠️ No similar chunks found from embeddings, falling back to keyword search');

        return this.keywordFallbackSearch(chunks, query, maxChunks, maxTokens, startTime);
      }

      // 4. Build context within token limit
      let tokenCount = 0;
      const selectedChunks: Array<{
        id: string;
        content: string;
        similarity: number;
        sourceId: string;
      }> = [];

      for (const item of similar) {
        const chunk = chunks.find(c => c.id === item.id);
        if (!chunk) continue;

        // Rough token estimate: 1 token ~ 4 chars
        const chunkTokens = Math.ceil(item.content.length / 4);

        if (tokenCount + chunkTokens > maxTokens) {
          // Would exceed limit - stop here
          logger.debug({
            step: 'RAG_8_TOKEN_LIMIT_REACHED',
            userId,
            currentTokens: tokenCount,
            maxTokens,
            chunksSelected: selectedChunks.length,
          }, '[RAG] ⚠️ Token limit reached, stopping chunk selection');
          break;
        }

        tokenCount += chunkTokens;
        selectedChunks.push({
          id: item.id,
          content: item.content,
          similarity: item.similarity,
          sourceId: chunk.sourceId,
        });

        if (selectedChunks.length >= maxChunks) break;
      }

      const retrievalTimeMs = Date.now() - startTime;

      logger.info({
        step: 'RAG_9_RETRIEVAL_COMPLETE',
        userId,
        queryLength: query.length,
        totalChunks: chunks.length,
        selectedChunks: selectedChunks.length,
        totalTokensEstimate: tokenCount,
        retrievalTimeMs,
        avgSimilarity: selectedChunks.length > 0
          ? (selectedChunks.reduce((s, c) => s + c.similarity, 0) / selectedChunks.length).toFixed(3)
          : 0,
        selectedChunksDetails: selectedChunks.map((c, i) => ({
          index: i + 1,
          chunkId: c.id,
          sourceId: c.sourceId,
          similarity: c.similarity.toFixed(3),
          contentLength: c.content.length,
          contentPreview: c.content.substring(0, 100),
        })),
      }, `[RAG] ✅ Retrieved ${selectedChunks.length} chunks (~${tokenCount} tokens) in ${retrievalTimeMs}ms`);

      return {
        chunks: selectedChunks,
        totalTokensEstimate: tokenCount,
        retrievalTimeMs,
      };
    } catch (error: any) {
      logger.error('[RAG] Error retrieving context:', error);
      return {
        chunks: [],
        totalTokensEstimate: 0,
        retrievalTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get user's knowledge chunks (with caching)
   */
  private async getUserKnowledgeChunks(userId: string): Promise<KnowledgeChunk[]> {
    // Check cache
    const cached = this.userKnowledgeCache.get(userId);
    if (cached && Date.now() - cached.lastRefreshed < this.cacheExpireMs) {
      logger.debug({
        step: 'RAG_CACHE_HIT',
        userId,
        cachedChunks: cached.chunks.length,
        cacheAge: Date.now() - cached.lastRefreshed,
      }, '[RAG] 💾 Cache hit - using cached chunks');
      return cached.chunks;
    }

    logger.info({
      step: 'RAG_DB_QUERY',
      userId,
    }, '[RAG] 📊 Querying database for knowledge chunks');

    // Fetch from database
    const result = await db.query(
      `SELECT kc.id, kc."sourceId", kc."chunkIndex", kc.content, kc.embedding
       FROM "knowledge_chunks" kc
       WHERE kc."userId" = $1
       ORDER BY kc."sourceId", kc."chunkIndex"`,
      [userId]
    );

    logger.info({
      step: 'RAG_DB_RESULT',
      userId,
      rowsReturned: result.rows.length,
      chunksWithEmbeddings: result.rows.filter(r => r.embedding && r.embedding !== '[]').length,
      chunksWithoutEmbeddings: result.rows.filter(r => !r.embedding || r.embedding === '[]').length,
    }, '[RAG] ✅ Database query complete');

    const chunks: KnowledgeChunk[] = result.rows.map(row => ({
      id: row.id,
      sourceId: row.sourceId,
      content: row.content,
      chunkIndex: row.chunkIndex,
      embedding: row.embedding ? this.parseEmbedding(row.embedding) : undefined,
    }));

    // Update cache
    this.userKnowledgeCache.set(userId, {
      chunks,
      lastRefreshed: Date.now(),
    });

    logger.debug({
      step: 'RAG_CACHE_UPDATED',
      userId,
      chunksCached: chunks.length,
    }, '[RAG] 💾 Cache updated with fresh chunks');

    return chunks;
  }

  /**
   * Parse embedding from database (stored as JSON or array)
   */
  private parseEmbedding(data: any): number[] | undefined {
    if (!data) return undefined;
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * Keyword-based fallback search when embeddings not available
   */
  private keywordFallbackSearch(
    chunks: KnowledgeChunk[],
    query: string,
    maxChunks: number,
    maxTokens: number,
    startTime: number
  ): RetrievedContext {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    // Score chunks by keyword overlap
    const scored = chunks.map(chunk => {
      const content = chunk.content.toLowerCase();
      let score = 0;

      queryWords.forEach(word => {
        if (content.includes(word)) {
          score += 1;
        }
      });

      return { chunk, score };
    });

    // Sort by score and select
    scored.sort((a, b) => b.score - a.score);

    let tokenCount = 0;
    const selectedChunks: Array<{
      id: string;
      content: string;
      similarity: number;
      sourceId: string;
    }> = [];

    for (const { chunk, score } of scored) {
      if (score === 0) continue; // No keyword match

      const chunkTokens = Math.ceil(chunk.content.length / 4);
      if (tokenCount + chunkTokens > maxTokens) break;

      tokenCount += chunkTokens;
      selectedChunks.push({
        id: chunk.id,
        content: chunk.content,
        similarity: score / queryWords.length, // Normalize
        sourceId: chunk.sourceId,
      });

      if (selectedChunks.length >= maxChunks) break;
    }

    return {
      chunks: selectedChunks,
      totalTokensEstimate: tokenCount,
      retrievalTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Build context string from retrieved chunks
   * This is what gets injected into the LLM prompt
   */
  buildContextString(retrieved: RetrievedContext): string {
    if (retrieved.chunks.length === 0) {
      return '';
    }

    const parts = retrieved.chunks.map((chunk, i) => {
      return `[Source ${i + 1}]: ${chunk.content}`;
    });

    return `RELEVANT KNOWLEDGE:\n${parts.join('\n\n')}`;
  }

  /**
   * Generate embeddings for all chunks of a user
   * Called when user uploads new content
   */
  async generateEmbeddingsForUser(userId: string): Promise<{
    success: boolean;
    processed: number;
    errors: number;
    cost: number;
  }> {
    logger.info(`[RAG] Generating embeddings for user ${userId}`);

    // Get all chunks without embeddings
    const result = await db.query(
      `SELECT id, content FROM "knowledge_chunks"
       WHERE "userId" = $1 AND (embedding IS NULL OR embedding = '[]')`,
      [userId]
    );

    if (result.rows.length === 0) {
      logger.info(`[RAG] No chunks need embeddings for user ${userId}`);
      return { success: true, processed: 0, errors: 0, cost: 0 };
    }

    const chunks = result.rows as Array<{ id: string; content: string }>;
    const texts = chunks.map(c => c.content);

    // Generate batch embeddings
    const embeddings = await embeddingService.generateBatchEmbeddings(texts);

    let processed = 0;
    let errors = 0;
    let totalCost = 0;

    // ✅ OPTIMIZATION: Batch update chunks instead of one-by-one
    // Update chunks in batches of 50 for better performance
    const batchSize = 50;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchEmbeddings = embeddings.slice(i, i + batchSize);
      
      // Prepare batch update queries
      const updatePromises = batch.map((chunk, j) => {
        const embedding = batchEmbeddings[j];
        totalCost += embedding.cost;
        
        return db.query(
          `UPDATE "knowledge_chunks" SET embedding = $1 WHERE id = $2`,
          [JSON.stringify(embedding.embedding), chunk.id]
        ).then(() => {
          processed++;
        }).catch((error: any) => {
          logger.error(`[RAG] Failed to update embedding for chunk ${chunk.id}:`, error.message);
          errors++;
        });
      });
      
      await Promise.all(updatePromises);
    }

    // Clear cache for this user
    this.userKnowledgeCache.delete(userId);

    logger.info(`[RAG] Embedding generation complete for user ${userId}`, {
      processed,
      errors,
      totalCost: totalCost.toFixed(6),
    });

    return { success: errors === 0, processed, errors, cost: totalCost };
  }

  /**
   * Clear user's knowledge cache
   */
  clearUserCache(userId: string): void {
    this.userKnowledgeCache.delete(userId);
  }

  /**
   * Get RAG stats for monitoring
   */
  getStats(): {
    cachedUsers: number;
    cacheHitRate: string;
  } {
    return {
      cachedUsers: this.userKnowledgeCache.size,
      cacheHitRate: 'N/A', // Would need tracking
    };
  }
}

export const ragService = new RAGService();
