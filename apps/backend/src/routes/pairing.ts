import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { createUserSession, resolveBearerSession } from '../security/auth.js';
import { generatePairingCode, generateToken, hashToken } from '../security/crypto.js';

const initBodySchema = z
  .object({
    deviceLabel: z.string().max(64).optional(),
  })
  .optional();

const claimBodySchema = z.object({
  code: z.string().trim().min(4).max(12),
});

export async function registerPairingRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/pair/init', async (request, reply) => {
    const parsed = initBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: 'INVALID_BODY' });
    }

    const sessionToken = generateToken(32);
    const sessionTokenHash = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + env.PAIRING_CODE_TTL_SECONDS * 1000);

    let code = '';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generatePairingCode(6);
      const res = await pool.query(
        `INSERT INTO pairing_codes (code, device_label, session_token_hash, status, expires_at)
         VALUES ($1, $2, $3, 'pending', $4)
         ON CONFLICT (code) DO NOTHING
         RETURNING code`,
        [candidate, parsed.data?.deviceLabel ?? 'Even G2', sessionTokenHash, expiresAt],
      );
      if ((res.rowCount ?? 0) > 0) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      return reply.status(500).send({ ok: false, error: 'CODE_GENERATION_FAILED' });
    }

    const hostHeader = request.headers.host ?? `localhost:${env.PORT}`;
    const proto = request.protocol || 'http';
    const setupUrl = `${proto}://${hostHeader}/setup`;

    return reply.status(201).send({
      ok: true,
      code,
      sessionToken,
      setupUrl,
      expiresAt: expiresAt.toISOString(),
    });
  });

  app.get('/api/pair/status', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ ok: false, error: 'UNAUTHORIZED' });
    }
    const token = authHeader.slice('Bearer '.length).trim();
    const tokenHash = hashToken(token);

    const active = await resolveBearerSession(authHeader);
    if (active) {
      const tgRes = await pool.query<{ phone_masked: string; status: string }>(
        `SELECT phone_masked, status FROM telegram_accounts WHERE user_id = $1 LIMIT 1`,
        [active.userId],
      );
      const chatRes = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM monitored_chats WHERE user_id = $1 AND enabled = TRUE`,
        [active.userId],
      );
      const tg = tgRes.rows[0];
      return reply.send({
        ok: true,
        paired: true,
        status: 'paired',
        telegramConnected: tg?.status === 'connected',
        telegramStatus: tg?.status ?? 'disconnected',
        phoneMasked: tg?.phone_masked ?? null,
        monitoredChatsCount: Number(chatRes.rows[0]?.count ?? '0'),
      });
    }

    const pendingRes = await pool.query<{ status: string; expires_at: Date }>(
      `SELECT status, expires_at
         FROM pairing_codes
        WHERE session_token_hash = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [tokenHash],
    );

    if (pendingRes.rowCount === 0) {
      return reply.status(401).send({ ok: false, error: 'PAIRING_NOT_FOUND' });
    }

    const row = pendingRes.rows[0];
    const expired = row.expires_at.getTime() <= Date.now();
    return reply.send({
      ok: true,
      paired: false,
      status: expired ? 'expired' : row.status,
      telegramConnected: false,
      monitoredChatsCount: 0,
    });
  });

  app.post('/api/pair/claim', async (request, reply) => {
    const parsed = claimBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: 'INVALID_CODE',
        message: 'Enter the 6-character pairing code shown on your G2 glasses.',
      });
    }

    const code = parsed.data.code.toUpperCase();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const codeRes = await client.query<{
        code: string;
        session_token_hash: string;
        status: string;
        expires_at: Date;
      }>(
        `SELECT code, session_token_hash, status, expires_at
           FROM pairing_codes
          WHERE code = $1
          FOR UPDATE`,
        [code],
      );

      if (codeRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({
          ok: false,
          error: 'CODE_NOT_FOUND',
          message: 'Pairing code not found. Request a new code on your G2.',
        });
      }

      const row = codeRes.rows[0];
      if (row.status !== 'pending' || row.expires_at.getTime() <= Date.now()) {
        await client.query('ROLLBACK');
        return reply.status(410).send({
          ok: false,
          error: 'CODE_EXPIRED',
          message: 'Pairing code expired or already claimed.',
        });
      }

      const userRes = await client.query<{ id: string }>(
        `INSERT INTO users DEFAULT VALUES RETURNING id`,
      );
      const userId = userRes.rows[0].id;

      await client.query(
        `UPDATE pairing_codes SET user_id = $1, status = 'paired' WHERE code = $2`,
        [userId, code],
      );

      const deviceExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await client.query(
        `INSERT INTO user_sessions (token_hash, user_id, kind, expires_at)
         VALUES ($1, $2, 'device', $3)`,
        [row.session_token_hash, userId, deviceExpiry],
      );

      await client.query('COMMIT');

      const setupSession = await createUserSession(userId, 'setup', 3600);
      return reply.send({
        ok: true,
        setupToken: setupSession.token,
        expiresAt: setupSession.expiresAt.toISOString(),
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
