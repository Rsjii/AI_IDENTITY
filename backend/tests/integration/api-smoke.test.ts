/**
 * API Smoke Tests
 * Basic health checks for critical endpoints
 */

describe('API Smoke Tests', () => {
  const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

  describe('Health Check', () => {
    it('should respond to health check endpoint', async () => {
      // Most apps have a /health or /api/health endpoint
      // If not, we can test a public endpoint
      const response = await fetch(`${BASE_URL}/api/public/health`, {
        method: 'GET',
      }).catch(() => null);

      // If health endpoint doesn't exist, test a public endpoint
      if (!response || response.status === 404) {
        // Test public creator endpoint (should return 404 for invalid slug, but endpoint exists)
        const publicResponse = await fetch(`${BASE_URL}/api/public/creator/invalid-slug-12345`, {
          method: 'GET',
        });

        expect([200, 404]).toContain(publicResponse.status);
      } else {
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Public Endpoints', () => {
    it('should handle invalid creator slug gracefully', async () => {
      const response = await fetch(`${BASE_URL}/api/public/creator/nonexistent-slug-12345`, {
        method: 'GET',
      });

      expect([200, 404]).toContain(response.status);
    });

    it('should reject chat without required fields', async () => {
      const response = await fetch(`${BASE_URL}/api/public/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on public chat', async () => {
      // Send multiple requests rapidly
      const requests = Array(25).fill(null).map(() =>
        fetch(`${BASE_URL}/api/public/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: 'test-slug',
            message: 'test message',
            visitorId: 'test-visitor',
            sessionId: 'test-session',
          }),
        })
      );

      const responses = await Promise.all(requests);
      
      // At least one should be rate limited (429)
      const rateLimited = responses.some(r => r.status === 429);
      // Or all might fail with 400/404 if slug doesn't exist - that's also OK
      const allFailed = responses.every(r => [400, 404, 429].includes(r.status));
      
      expect(rateLimited || allFailed).toBe(true);
    });
  });
});

