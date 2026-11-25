import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../security/auth.js';
import {
  AiServiceError,
  aiService,
  type ContextMessageInput,
} from '../services/aiService.js';

const summarizeSchema = z.object({
  chatId: z.string().trim().max(64).optional(),
  chatTitle: z.string().trim().max(160).optional(),
});

const replySchema = z.object({
  chatId: z.string().trim().min(1).max(64),
  chatTitle: z.string().trim().min(1).max(160),
  sender: z.string().trim().min(1).max(120),
  incomingText: z.string().trim().min(1).max(4000),
  variationIndex: z.number().int().min(0).max(10).default(0),
  instruction: z.string().trim().max(500).optional(),
});

const askSchema = z.object({
  question: z.string().trim().min(2).max(500),
  chatId: z.string().trim().max(64).optional(),
});

const translateSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  targetLanguage: z.string().trim().max(48).optional(),
});

const intentSchema = z.object({
  transcript: z.string().trim().min(1).max(1000),
  hasActiveMessage: z.boolean().default(false),
});

async function loadAuthorizedContext(
  userId: string,
  chatId?: string,
  limit = 25,
): Promise<{
  messages: ContextMessageInput[];
  monitoredTitles: string[];
}> {
  const chatsRes = await pool.query<{ telegram_chat_id: string; title: string }>(
    `SELECT telegram_chat_id, title
       FROM monitored_chats
      WHERE user_id = $1 AND enabled = TRUE
      ORDER BY priority_weight DESC, created_at ASC`,
    [userId],
  );

  const monitoredTitles = chatsRes.rows.map((r) => r.title);
  if (chatsRes.rowCount === 0) {
    return { messages: [], monitoredTitles };
  }

  const msgRes = await pool.query<{
    telegram_chat_id: string;
    title: string;
    sender_name: string;
    body_preview: string;
    received_at: Date;
  }>(
    `SELECT mc.telegram_chat_id, ch.title, mc.sender_name, mc.body_preview, mc.received_at
       FROM message_cache mc
       INNER JOIN monitored_chats ch
         ON ch.user_id = mc.user_id
        AND ch.telegram_chat_id = mc.telegram_chat_id
        AND ch.enabled = TRUE
      WHERE mc.user_id = $1
        AND ($2::text IS NULL OR mc.telegram_chat_id = $2)
      ORDER BY mc.received_at DESC
      LIMIT $3`,
    [userId, chatId ?? null, limit],
  );

  return {
    messages: msgRes.rows.map((r) => ({
      chatId: r.telegram_chat_id,
      chatTitle: r.title,
      sender: r.sender_name,
      text: r.body_preview,
      receivedAt: r.received_at.toISOString(),
    })),
    monitoredTitles,
  };
}

function handleAiError(err: unknown, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) {
  if (err instanceof AiServiceError) {
    return reply.status(err.statusCode).send({
      ok: false,
      error: err.code,
      message: err.message,
    });
  }
  throw err;
}

export async function registerAiRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/ai/summarize', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = summarizeSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: 'INVALID_REQUEST' });
    }
    try {
      const ctx = await loadAuthorizedContext(request.authUserId!, parsed.data.chatId, 25);
      const chatTitle =
        parsed.data.chatTitle ||
        ctx.messages[0]?.chatTitle ||
        ctx.monitoredTitles[0] ||
        'MONITORED CHATS';

      const summary = await aiService.summarizeMessages({
        chatTitle,
        messages: ctx.messages,
      });

      return reply.send({
        ok: true,
        summary: {
          chatTitle: summary.chatTitle,
          unreadCount: ctx.messages.length,
          lines: summary.lines,
          actionCount: summary.actionCount,
          dates: summary.dates,
          actionItems: summary.actionItems,
          questions: summary.questions,
        },
      });
    } catch (err) {
      return handleAiError(err, reply);
    }
  });

  app.post('/api/ai/reply', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = replySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: 'INVALID_REQUEST', message: 'chatId, chatTitle, sender, and incomingText are required.' });
    }
    try {
      const ctx = await loadAuthorizedContext(request.authUserId!, parsed.data.chatId, 8);
      const result = await aiService.suggestReply({
        chatTitle: parsed.data.chatTitle,
        sender: parsed.data.sender,
        incomingText: parsed.data.incomingText,
        recentContext: ctx.messages,
        variationIndex: parsed.data.variationIndex,
        instruction: parsed.data.instruction,
      });
      return reply.send({ ok: true, ...result });
    } catch (err) {
      return handleAiError(err, reply);
    }
  });

  app.post('/api/ai/ask', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = askSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: 'INVALID_QUESTION', message: 'Question is required.' });
    }
    try {
      const ctx = await loadAuthorizedContext(request.authUserId!, parsed.data.chatId, 30);
      const result = await aiService.answerContextQuestion({
        question: parsed.data.question,
        authorizedMessages: ctx.messages,
      });
      return reply.send({ ok: true, ...result });
    } catch (err) {
      return handleAiError(err, reply);
    }
  });

  app.post('/api/ai/translate', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = translateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: 'INVALID_TEXT', message: 'Text to translate is required.' });
    }
    try {
      const result = await aiService.translateMessage({
        text: parsed.data.text,
        targetLanguage: parsed.data.targetLanguage,
      });
      return reply.send({ ok: true, ...result });
    } catch (err) {
      return handleAiError(err, reply);
    }
  });

  app.post('/api/ai/intent', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = intentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: 'INVALID_TRANSCRIPT' });
    }
    try {
      const ctx = await loadAuthorizedContext(request.authUserId!, undefined, 1);
      const result = await aiService.detectCommandIntent({
        transcript: parsed.data.transcript,
        hasActiveMessage: parsed.data.hasActiveMessage,
        availableChats: ctx.monitoredTitles,
      });
      return reply.send({ ok: true, ...result });
    } catch (err) {
      return handleAiError(err, reply);
    }
  });
}
