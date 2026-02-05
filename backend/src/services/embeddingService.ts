/**
 * Embedding Service - Generates vector embeddings for RAG
 *
 * Uses OpenAI text-embedding-3-small for cost-effective embeddings
 * Fallback: Simple TF-IDF based similarity if OpenAI unavailable
 */

import OpenAI from 'openai';
import { config } from '../config/env';
import { logger } from '../config/logger';
import crypto from 'crypto';

// OpenAI Embedding Model (cheapest & fast)
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

// Price: $0.00002 per 1K tokens (very cheap)
const EMBEDDING_COST_PER_1K_TOKENS = 0.00002;

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokensUsed: number;
  cost: number;
}

class EmbeddingService {
  private openai: OpenAI | null = null;
  private embeddingCache: Map<string, number[]> = new Map();
  private cacheMaxSize = 10000; // Max cached embeddings

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
      logger.info('Embedding Service initialized with OpenAI');
    } else {
      logger.warn('Embedding Service: No OpenAI API key, using fallback similarity');
    }
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const cleanText = this.cleanTextForEmbedding(text);

    // Check cache first
    const cacheKey = this.getCacheKey(cleanText);
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return {
        embedding: cached,
        model: 'cache',
        tokensUsed: 0,
        cost: 0,
      };
    }

    // Use OpenAI if available
    if (this.openai) {
      try {
        const response = await this.openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: cleanText,
          dimensions: EMBEDDING_DIMENSIONS,
        });

        const embedding = response.data[0].embedding;
        const tokensUsed = response.usage?.total_tokens || 0;
        const cost = (tokensUsed / 1000) * EMBEDDING_COST_PER_1K_TOKENS;

        // Cache the result
        this.addToCache(cacheKey, embedding);

        logger.debug(`Generated embedding: ${tokensUsed} tokens, $${cost.toFixed(6)}`);

        return {
          embedding,
          model: EMBEDDING_MODEL,
          tokensUsed,
          cost,
        };
      } catch (error: any) {
        logger.error('OpenAI embedding failed, using fallback:', error.message);
        return this.generateFallbackEmbedding(cleanText);
      }
    }

    // Fallback to simple embedding
    return this.generateFallbackEmbedding(cleanText);
  }

  /**
   * Generate embeddings for multiple texts (batch)
   * More efficient than calling one by one
   */
  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.openai || texts.length === 0) {
      return Promise.all(texts.map(t => this.generateFallbackEmbedding(t)));
    }

    // Check which are cached
    const results: (EmbeddingResult | null)[] = new Array(texts.length).fill(null);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    texts.forEach((text, i) => {
      const cleanText = this.cleanTextForEmbedding(text);
      const cacheKey = this.getCacheKey(cleanText);
      const cached = this.embeddingCache.get(cacheKey);

      if (cached) {
        results[i] = {
          embedding: cached,
          model: 'cache',
          tokensUsed: 0,
          cost: 0,
        };
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(cleanText);
      }
    });

    // Batch generate uncached embeddings
    if (uncachedTexts.length > 0) {
      try {
        // OpenAI batch limit is 2048 texts
        const batchSize = 100;
        for (let i = 0; i < uncachedTexts.length; i += batchSize) {
          const batch = uncachedTexts.slice(i, i + batchSize);
          const batchIndices = uncachedIndices.slice(i, i + batchSize);

          const response = await this.openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: batch,
            dimensions: EMBEDDING_DIMENSIONS,
          });

          const tokensPerItem = Math.ceil((response.usage?.total_tokens || 0) / batch.length);
          const costPerItem = (tokensPerItem / 1000) * EMBEDDING_COST_PER_1K_TOKENS;

          response.data.forEach((item, j) => {
            const originalIndex = batchIndices[j];
            const embedding = item.embedding;

            // Cache
            const cacheKey = this.getCacheKey(batch[j]);
            this.addToCache(cacheKey, embedding);

            results[originalIndex] = {
              embedding,
              model: EMBEDDING_MODEL,
              tokensUsed: tokensPerItem,
              cost: costPerItem,
            };
          });
        }

        logger.info(`Generated batch embeddings: ${uncachedTexts.length} new, ${texts.length - uncachedTexts.length} cached`);
      } catch (error: any) {
        logger.error('Batch embedding failed, using fallback:', error.message, error.stack);
        // Fill remaining with fallback (one by one, slower but more reliable)
        for (let i = 0; i < uncachedIndices.length; i++) {
          if (!results[uncachedIndices[i]]) {
            try {
              results[uncachedIndices[i]] = await this.generateFallbackEmbedding(uncachedTexts[i]);
            } catch (fallbackError: any) {
              logger.error(`Fallback embedding failed for text ${i}:`, fallbackError.message);
              // Use zero vector as last resort
              results[uncachedIndices[i]] = {
                embedding: new Array(EMBEDDING_DIMENSIONS).fill(0),
                model: 'fallback-error',
                tokensUsed: 0,
                cost: 0,
              };
            }
          }
        }
      }
    }

    return results as EmbeddingResult[];
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      logger.warn('Embedding dimension mismatch, using fallback comparison');
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * Find top-k most similar embeddings
   */
  findTopKSimilar(
    queryEmbedding: number[],
    candidates: Array<{ id: string; embedding: number[]; content: string }>,
    k: number = 5,
    minSimilarity: number = 0.3
  ): Array<{ id: string; content: string; similarity: number }> {
    const scored = candidates
      .map(c => ({
        id: c.id,
        content: c.content,
        similarity: this.cosineSimilarity(queryEmbedding, c.embedding),
      }))
      .filter(c => c.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);

    return scored;
  }

  /**
   * Clean text before embedding
   */
  private cleanTextForEmbedding(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?;:()'-]/g, '')
      .trim()
      .substring(0, 8000); // Max input for embedding model
  }

  /**
   * Generate cache key
   */
  private getCacheKey(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * Add to cache with LRU eviction
   */
  private addToCache(key: string, embedding: number[]): void {
    if (this.embeddingCache.size >= this.cacheMaxSize) {
      // Remove oldest (first) entry
      const firstKey = this.embeddingCache.keys().next().value;
      if (firstKey) {
        this.embeddingCache.delete(firstKey);
      }
    }
    this.embeddingCache.set(key, embedding);
  }

  /**
   * Fallback: Simple TF-IDF-like embedding
   * Used when OpenAI is unavailable
   */
  private async generateFallbackEmbedding(text: string): Promise<EmbeddingResult> {
    // Simple bag-of-words hash-based embedding
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const embedding = new Array(256).fill(0); // Smaller dimension for fallback

    words.forEach((word, i) => {
      // Hash each word to a position
      const hash = this.simpleHash(word);
      const pos = hash % 256;
      const weight = 1 / Math.log(i + 2); // Position-based weighting
      embedding[pos] += weight;
    });

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }

    return {
      embedding,
      model: 'fallback-tfidf',
      tokensUsed: 0,
      cost: 0,
    };
  }

  /**
   * Simple hash function for fallback
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Check if OpenAI embeddings are available
   */
  isOpenAIAvailable(): boolean {
    return this.openai !== null;
  }

  /**
   * Get embedding dimensions
   */
  getEmbeddingDimensions(): number {
    return this.openai ? EMBEDDING_DIMENSIONS : 256;
  }
}

export const embeddingService = new EmbeddingService();
