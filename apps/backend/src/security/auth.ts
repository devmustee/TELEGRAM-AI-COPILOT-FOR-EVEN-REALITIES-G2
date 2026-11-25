import type { FastifyReply, FastifyRequest } from 'fastify';
import { pool } from '../db/pool.js';
import { generateToken, hashToken } from './crypto.js';

export async function createUserSession(
  userId: string,
  kind: 'device' | 'setup',
  ttlSeconds = 60 * 60 * 24 * 7,
): Promise<{ token: string; tokenHash: string; expiresAt: Date }> {
  const token = generateToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await pool.query(
    `INSERT INTO user_sessions (token_hash, user_id, kind, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [tokenHash, userId, kind, expiresAt],
  );

  return { token, tokenHash, expiresAt };
}

export async function resolveBearerSession(
  authHeader: string | undefined,
): Promise<{ userId: string; kind: 'device' | 'setup' } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  const tokenHash = hashToken(token);
  const res = await pool.query<{ user_id: string; kind: 'device' | 'setup' }>(
    `SELECT user_id, kind
       FROM user_sessions
      WHERE token_hash = $1
        AND expires_at > NOW()
      LIMIT 1`,
    [tokenHash],
  );
  if (res.rowCount === 0) return null;
  return { userId: res.rows[0].user_id, kind: res.rows[0].kind };
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const session = await resolveBearerSession(request.headers.authorization);
  if (!session) {
    await reply.status(401).send({
      ok: false,
      error: 'UNAUTHORIZED',
      message: 'Valid session token required. Pair device via /setup first.',
    });
    return;
  }
  request.authUserId = session.userId;
  request.authSessionKind = session.kind;
}
