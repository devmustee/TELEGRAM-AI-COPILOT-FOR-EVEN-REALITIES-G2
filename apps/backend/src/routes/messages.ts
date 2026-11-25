import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../security/auth.js';
import {
  TelegramServiceError,
  sendConfirmedTelegramMessage,
  syncImportantMessages,
} from '../services/telegramService.js';

const sendBodySchema = z.object({
  chatId: z.string().trim().min(1).max(64),
  text: z.string().trim().min(1).max(4000),
  replyToMsgId: z.number().int().positive().optional(),
  source: z.enum(['ai', 'voice']).default('ai'),
  confirmed: z.literal(true),
});

export async function registerMessageRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/messages/important', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const result = await syncImportantMessages(request.authUserId!);
      return reply.send({
        ok: true,
        messages: result.messages.map((m) => ({
          id: m.id,
          chatId: m.chatId,
          chatTitle: m.chatTitle,
          sender: m.sender,
          timestampLabel: m.timestampLabel,
          text: m.text,
          urgency: m.urgency,
          needsReply: m.needsReply,
          importanceScore: m.importanceScore,
        })),
        summary: result.summary,
      });
    } catch (err) {
      if (err instanceof TelegramServiceError) {
        return reply.status(err.statusCode).send({
          ok: false,
          error: err.code,
          message: err.message,
        });
      }
      throw err;
    }
  });

  app.post('/api/messages/send', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = sendBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: 'CONFIRMATION_REQUIRED',
        message: 'Explicit confirmed=true, chatId, and text are required to send.',
      });
    }

    try {
      const result = await sendConfirmedTelegramMessage({
        userId: request.authUserId!,
        chatId: parsed.data.chatId,
        text: parsed.data.text,
        replyToMsgId: parsed.data.replyToMsgId,
        source: parsed.data.source,
      });
      return reply.send({ ok: true, ...result });
    } catch (err) {
      if (err instanceof TelegramServiceError) {
        return reply.status(err.statusCode).send({
          ok: false,
          error: err.code,
          message: err.message,
        });
      }
      throw err;
    }
  });
}
