import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../security/auth.js';
import {
  TelegramServiceError,
  disconnectTelegramUser,
  listUserDialogs,
  startPhoneLogin,
  verifyLoginCode,
} from '../services/telegramService.js';

const startAuthSchema = z.object({
  phoneNumber: z.string().trim().min(6).max(24),
});

const verifyAuthSchema = z.object({
  code: z.string().trim().min(3).max(12),
  password: z.string().max(128).optional(),
});

const saveChatsSchema = z.object({
  chats: z
    .array(
      z.object({
        telegramChatId: z.string().trim().min(1).max(64),
        title: z.string().trim().min(1).max(160),
        chatType: z.enum(['dm', 'group', 'channel']).default('group'),
        priorityWeight: z.number().int().min(1).max(3).default(1),
        enabled: z.boolean().default(true),
      }),
    )
    .max(10),
});

export async function registerTelegramRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/telegram/auth/start', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = startAuthSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: 'INVALID_PHONE', message: 'Valid phone number required.' });
    }
    try {
      const result = await startPhoneLogin(request.authUserId!, parsed.data.phoneNumber);
      return reply.send({ ok: true, ...result });
    } catch (err) {
      if (err instanceof TelegramServiceError) {
        return reply.status(err.statusCode).send({ ok: false, error: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.post('/api/telegram/auth/verify', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = verifyAuthSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: 'INVALID_CODE', message: 'Verification code required.' });
    }
    try {
      const result = await verifyLoginCode(
        request.authUserId!,
        parsed.data.code,
        parsed.data.password,
      );
      return reply.send({ ok: true, ...result });
    } catch (err) {
      if (err instanceof TelegramServiceError) {
        return reply.status(err.statusCode).send({ ok: false, error: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.post('/api/telegram/disconnect', { preHandler: requireAuth }, async (request, reply) => {
    await disconnectTelegramUser(request.authUserId!);
    return reply.send({ ok: true });
  });

  app.get('/api/telegram/dialogs', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const dialogs = await listUserDialogs(request.authUserId!);
      return reply.send({ ok: true, dialogs });
    } catch (err) {
      if (err instanceof TelegramServiceError) {
        return reply.status(err.statusCode).send({ ok: false, error: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.get('/api/chats', { preHandler: requireAuth }, async (request, reply) => {
    const res = await pool.query<{
      telegram_chat_id: string;
      title: string;
      chat_type: string;
      priority_weight: number;
      enabled: boolean;
    }>(
      `SELECT telegram_chat_id, title, chat_type, priority_weight, enabled
         FROM monitored_chats
        WHERE user_id = $1
        ORDER BY priority_weight DESC, created_at ASC`,
      [request.authUserId!],
    );
    return reply.send({
      ok: true,
      chats: res.rows.map((r) => ({
        telegramChatId: r.telegram_chat_id,
        title: r.title,
        chatType: r.chat_type,
        priorityWeight: r.priority_weight,
        enabled: r.enabled,
      })),
    });
  });

  app.put('/api/chats', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = saveChatsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: 'INVALID_CHATS', message: 'Invalid monitored chat list.' });
    }

    const userId = request.authUserId!;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM monitored_chats WHERE user_id = $1`, [userId]);
      for (const chat of parsed.data.chats) {
        await client.query(
          `INSERT INTO monitored_chats (user_id, telegram_chat_id, title, chat_type, priority_weight, enabled)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            chat.telegramChatId,
            chat.title,
            chat.chatType,
            chat.priorityWeight,
            chat.enabled,
          ],
        );
      }
      await client.query('COMMIT');
      return reply.send({ ok: true, count: parsed.data.chats.length });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
