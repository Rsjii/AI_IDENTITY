import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { extensionTokenQueries } from '../../config/database';

export async function createExtensionToken(userId: string, label?: string) {
  const secret = crypto.randomBytes(32).toString('hex'); // 64 chars
  const tokenHash = await bcrypt.hash(secret, 12);

  const row = await extensionTokenQueries.create(userId, tokenHash, label, ['mirror:write', 'identity:read']);

  // raw token shown ONCE
  const token = `${userId}.${secret}`;

  return {
    token, // show once
    tokenId: row.id,
    label: row.label,
    scopes: row.scopes,
    createdAt: row.createdAt,
  };
}

export async function listExtensionTokens(userId: string) {
  return await extensionTokenQueries.listForUser(userId);
}

export async function revokeExtensionToken(userId: string, tokenId: string) {
  const row = await extensionTokenQueries.revoke(userId, tokenId);
  if (!row) throw new Error('Token not found or already revoked');
  return row;
}


