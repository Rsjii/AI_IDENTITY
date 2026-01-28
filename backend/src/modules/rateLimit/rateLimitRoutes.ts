import { Router } from 'express';
import { RATE_LIMITS } from '../../config/rateLimitConfig';
import { PostgreSQLRateLimitStore } from '../../config/rateLimitStore';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';

const router = Router();

const rlKey = (prefix: string, raw: string) => `${prefix}:${raw || 'unknown'}`;

function getIp(req: any): string {
  return req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
}

function getSessionId(req: any): string | undefined {
  const raw = req.headers['x-session-id'];
  const header = Array.isArray(raw) ? raw[0] : raw;
  return (header as string | undefined) || (req.query?.sessionId as string | undefined);
}

function getUserOrIp(req: any): string {
  return req.user?.id || req.user?.userId || getIp(req);
}

/**
 * GET /api/rate-limit/status
 * Returns current counters (best-effort) for known limiters.
 * Note: remaining/reset are computed from the DB-backed store.
 */
router.get('/status', async (req, res) => {
  try {
    const ip = getIp(req);
    const sessionId = getSessionId(req);

    // Public chat uses sessionId+IP when present, else IP
    const publicRaw = sessionId ? `${sessionId}:${ip}` : ip;
    const publicKey = rlKey('publicChat', publicRaw);
    const publicStore = new PostgreSQLRateLimitStore((RATE_LIMITS as any).publicChat.windowMs);
    const publicInfo = await publicStore.get(publicKey);

    // Authenticated chat uses logged-in userId (fallback IP)
    const authRaw = String(getUserOrIp(req));
    const authKey = rlKey('authenticatedChat', authRaw);
    const authStore = new PostgreSQLRateLimitStore((RATE_LIMITS as any).authenticatedChat.windowMs);
    const authInfo = await authStore.get(authKey);

    const publicMax = (RATE_LIMITS as any).publicChat.max;
    const authMax = (RATE_LIMITS as any).authenticatedChat.max;

    return res.json({
      success: true,
      now: new Date().toISOString(),
      identifiers: {
        ip,
        sessionId: sessionId || null,
        userId: req.user?.id || req.user?.userId || null,
      },
      publicChat: {
        windowMs: (RATE_LIMITS as any).publicChat.windowMs,
        max: publicMax,
        used: publicInfo?.totalHits ?? 0,
        remaining: Math.max(0, publicMax - (publicInfo?.totalHits ?? 0)),
        resetTime: publicInfo?.resetTime ? publicInfo.resetTime.toISOString() : null,
      },
      authenticatedChat: {
        windowMs: (RATE_LIMITS as any).authenticatedChat.windowMs,
        max: authMax,
        used: authInfo?.totalHits ?? 0,
        remaining: Math.max(0, authMax - (authInfo?.totalHits ?? 0)),
        resetTime: authInfo?.resetTime ? authInfo.resetTime.toISOString() : null,
      },
    });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to read rate limit status' });
  }
});

/**
 * POST /api/rate-limit/reset
 * Resets authenticated limiter for the current user (useful for support/debug).
 */
router.post('/reset', requireJWTFromCookie, async (req, res) => {
  const authStore = new PostgreSQLRateLimitStore((RATE_LIMITS as any).authenticatedChat.windowMs);
  const authRaw = String(getUserOrIp(req));
  const authKey = rlKey('authenticatedChat', authRaw);
  await authStore.resetKey(authKey);
  return res.json({ success: true });
});

export default router;


