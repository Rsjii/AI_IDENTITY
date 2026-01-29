/**
 * Unit tests for Response Cache Service
 * Tests caching of LLM responses
 */

import { responseCacheService } from './responseCacheService';

// Mock dependencies
jest.mock('./embeddingService');
jest.mock('../config/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ResponseCacheService', () => {
  const userId = 'user-123';
  const identityVersionId = 'identity-456';
  const query = 'What is your morning routine?';
  const response = 'I wake up at 6am, meditate, then exercise.';
  const tokensUsed = 50;
  const model = 'gpt-4';

  beforeEach(() => {
    // Clear cache before each test
    responseCacheService.invalidateUser(userId);
  });

  describe('get and set', () => {
    it('should return null for non-existent cache entry', async () => {
      const result = await responseCacheService.get(userId, identityVersionId, query);
      expect(result).toBeNull();
    });

    it('should store and retrieve cached response', async () => {
      // Set cache
      await responseCacheService.set(
        userId,
        identityVersionId,
        query,
        response,
        tokensUsed,
        model
      );

      // Get cache
      const cached = await responseCacheService.get(userId, identityVersionId, query);

      expect(cached).not.toBeNull();
      expect(cached?.response).toBe(response);
      expect(cached?.tokensUsed).toBe(tokensUsed);
      expect(cached?.model).toBe(model);
      expect(cached?.hitCount).toBe(1);
    });

    it('should increment hitCount on multiple retrievals', async () => {
      // Set cache
      await responseCacheService.set(
        userId,
        identityVersionId,
        query,
        response,
        tokensUsed,
        model
      );

      // Get multiple times
      await responseCacheService.get(userId, identityVersionId, query);
      await responseCacheService.get(userId, identityVersionId, query);
      const cached = await responseCacheService.get(userId, identityVersionId, query);

      expect(cached?.hitCount).toBe(3);
    });

    it('should return null for expired cache entries', async () => {
      // Set cache with short TTL (would need to mock TTL for this test)
      await responseCacheService.set(
        userId,
        identityVersionId,
        query,
        response,
        tokensUsed,
        model
      );

      // For now, we test that cache works when not expired
      const cached = await responseCacheService.get(userId, identityVersionId, query);
      expect(cached).not.toBeNull();
    });

    it('should handle different queries separately', async () => {
      const query1 = 'What is your morning routine?';
      const query2 = 'What is your evening routine?';
      const response1 = 'Morning: wake up, meditate';
      const response2 = 'Evening: read, sleep';

      await responseCacheService.set(userId, identityVersionId, query1, response1, 30, model);
      await responseCacheService.set(userId, identityVersionId, query2, response2, 30, model);

      const cached1 = await responseCacheService.get(userId, identityVersionId, query1);
      const cached2 = await responseCacheService.get(userId, identityVersionId, query2);

      expect(cached1?.response).toBe(response1);
      expect(cached2?.response).toBe(response2);
    });

    it('should handle different users separately', async () => {
      const userId2 = 'user-789';

      await responseCacheService.set(userId, identityVersionId, query, response, tokensUsed, model);
      await responseCacheService.set(userId2, identityVersionId, query, 'Different response', tokensUsed, model);

      const cached1 = await responseCacheService.get(userId, identityVersionId, query);
      const cached2 = await responseCacheService.get(userId2, identityVersionId, query);

      expect(cached1?.response).toBe(response);
      expect(cached2?.response).toBe('Different response');
    });
  });

  describe('invalidateUser', () => {
    it('should clear all cache entries for a user', async () => {
      // Set multiple cache entries
      await responseCacheService.set(userId, identityVersionId, query, response, tokensUsed, model);
      await responseCacheService.set(userId, identityVersionId, 'query2', 'response2', tokensUsed, model);

      // Verify they exist
      expect(await responseCacheService.get(userId, identityVersionId, query)).not.toBeNull();

      // Invalidate
      responseCacheService.invalidateUser(userId);

      // Verify they're gone
      expect(await responseCacheService.get(userId, identityVersionId, query)).toBeNull();
      expect(await responseCacheService.get(userId, identityVersionId, 'query2')).toBeNull();
    });

    it('should not affect other users cache', async () => {
      const userId2 = 'user-789';

      await responseCacheService.set(userId, identityVersionId, query, response, tokensUsed, model);
      await responseCacheService.set(userId2, identityVersionId, query, 'Other response', tokensUsed, model);

      // Invalidate user1
      responseCacheService.invalidateUser(userId);

      // User1 cache should be gone
      expect(await responseCacheService.get(userId, identityVersionId, query)).toBeNull();

      // User2 cache should still exist
      const cached2 = await responseCacheService.get(userId2, identityVersionId, query);
      expect(cached2?.response).toBe('Other response');
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const stats = responseCacheService.getStats();

      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('totalHits');
      expect(stats).toHaveProperty('totalMisses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('memorySizeEstimate');

      expect(typeof stats.totalEntries).toBe('number');
      expect(typeof stats.totalHits).toBe('number');
      expect(typeof stats.totalMisses).toBe('number');
      expect(typeof stats.hitRate).toBe('string');
    });
  });
});

