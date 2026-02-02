import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { extensionTokenQueries } from '../config/database';

export type ExtensionAuthedRequest = Request & {
  user?: { id: string; userId: string; email?: string };
  extensionToken?: { id: string; userId: string; label?: string; scopes?: string[] };
};

export async function requireExtensionBearer(req: ExtensionAuthedRequest, res: Response, next: NextFunction) {
  try {
    const auth = String(req.headers.authorization || '');
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      return res.status(401).json({ error: 'Bearer token required', errorCode: 'EXT_TOKEN_REQUIRED' });
    }

    const rawToken = m[1].trim();
    if (!rawToken || rawToken.length < 20) {
      return res.status(401).json({ error: 'Invalid bearer token', errorCode: 'EXT_TOKEN_INVALID' });
    }

    // ✅ MVP approach: token format = "userId.tokenSecret"
    // This avoids scanning the whole table.
    const parts = rawToken.split('.');
    if (parts.length !== 2) {
      return res.status(401).json({ error: 'Invalid bearer token format', errorCode: 'EXT_TOKEN_INVALID' });
    }

    const userId = parts[0];
    const secret = parts[1];

    const activeTokens = await extensionTokenQueries.listActiveForUser(userId);
    if (!activeTokens.length) {
      return res.status(401).json({ error: 'No active tokens', errorCode: 'EXT_TOKEN_INVALID' });
    }

    let matched: any = null;
    for (const t of activeTokens) {
      const ok = await bcrypt.compare(secret, t.tokenHash);
      if (ok) {
        matched = t;
        break;
      }
    }

    if (!matched) {
      return res.status(401).json({ error: 'Invalid bearer token', errorCode: 'EXT_TOKEN_INVALID' });
    }

    // attach user + token
    req.user = { id: userId, userId, email: '' }; // email not available for extension auth
    req.extensionToken = {
      id: matched.id,
      userId,
      label: matched.label || undefined,
      scopes: Array.isArray(matched.scopes) ? matched.scopes : undefined,
    };

    // update lastUsedAt (non-blocking)
    extensionTokenQueries.updateLastUsedAt(matched.id).catch(() => {});

    return next();
  } catch (err: any) {
    return res.status(500).json({ error: 'Extension auth failed', errorCode: 'EXT_AUTH_ERROR' });
  }
}


