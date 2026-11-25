import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../security/auth.js';
import {
  AiServiceError,
  aiService,
  type ContextMessageInput,
} from '../services/aiService.js';
import { voiceService } from '../services/voiceService.js';

const voiceCommandSchema = z
  .object({
    pcmBase64: z.string().min(16).optional(),
    transcript: z.string().trim().min(1).max(1000).optional(),
    mode: z.enum(['command', 'reply_edit']).default('command'),
    activeMessage: z
      .object({
        id: z.string(),
        chatId: z.string(),
        chatTitle: z.string(),
        sender: z.string(),
        text: z.string(),
      })
      .optional(),
  })
  .refine((data) => Boolean(data.pcmBase64 || data.transcript), {
    message: 'Either pcmBase64 audio or transcript text must be provided.',
  });

async function loadAuthorizedContext(
  userId: string,
  chatId?: string,
  limit = 25,
): Promise<{
  chats: Array<{ chatId: string; title: string }>;
  messages: ContextMessageInput[];
}> {
  const chatsRes = await pool.query<{ telegram_chat_id: string; title: string }>(
    `SELECT telegram_chat_id, title
       FROM monitored_chats
      WHERE user_id = $1 AND enabled = TRUE
      ORDER BY priority_weight DESC, created_at ASC`,
    [userId],
  );

  const chats = chatsRes.rows.map((r) => ({
    chatId: r.telegram_chat_id,
    title: r.title,
  }));

  if (chats.length === 0) {
    return { chats: [], messages: [] };
  }

  const msgRes = await pool.query<{
    telegram_chat_id: string;
    telegram_msg_id: string;
    title: string;
    sender_name: string;
    body_preview: string;
    received_at: Date;
  }>(
    `SELECT mc.telegram_chat_id, mc.telegram_msg_id::text, ch.title, mc.sender_name, mc.body_preview, mc.received_at
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
    chats,
    messages: msgRes.rows.map((r) => ({
      chatId: r.telegram_chat_id,
      chatTitle: r.title,
      sender: r.sender_name,
      text: r.body_preview,
      receivedAt: r.received_at.toISOString(),
    })),
  };
}

export async function registerVoiceRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/voice/command',
    {
      preHandler: requireAuth,
      bodyLimit: 2 * 1024 * 1024,
    },
    async (request, reply) => {
      const parsed = voiceCommandSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          ok: false,
          error: 'INVALID_VOICE_PAYLOAD',
          message: 'Valid audio PCM payload or transcript is required.',
        });
      }

      const userId = request.authUserId!;
      const { pcmBase64, mode, activeMessage } = parsed.data;

      try {
        const transcript = parsed.data.transcript
          ? parsed.data.transcript
          : await voiceService.transcribePcm(Buffer.from(pcmBase64!, 'base64'));

        const ctx = await loadAuthorizedContext(userId, undefined, 25);

        if (mode === 'reply_edit' && activeMessage) {
          const chatMsgs = ctx.messages.filter((m) => m.chatId === activeMessage.chatId);
          const replyDraft = await aiService.suggestReply({
            chatTitle: activeMessage.chatTitle,
            sender: activeMessage.sender,
            incomingText: activeMessage.text,
            recentContext: chatMsgs,
            instruction: transcript,
          });
          return reply.send({
            ok: true,
            transcript,
            action: 'draft_reply',
            draftText: replyDraft.replyText,
            targetMessage: activeMessage,
          });
        }

        const intent = await aiService.detectCommandIntent({
          transcript,
          hasActiveMessage: Boolean(activeMessage),
          availableChats: ctx.chats.map((c) => c.title),
        });

        switch (intent.intent) {
          case 'summarize_chat': {
            const matchedChat = intent.chatQuery
              ? ctx.chats.find((c) =>
                  c.title.toLowerCase().includes(intent.chatQuery!.toLowerCase()),
                )
              : undefined;
            const filteredMsgs = matchedChat
              ? ctx.messages.filter((m) => m.chatId === matchedChat.chatId)
              : ctx.messages;
            const chatTitle = matchedChat?.title ?? ctx.chats[0]?.title ?? 'MONITORED CHATS';
            const summary = await aiService.summarizeMessages({
              chatTitle,
              messages: filteredMsgs,
            });
            return reply.send({
              ok: true,
              transcript,
              action: 'summarize_chat',
              summary: {
                chatTitle: summary.chatTitle,
                unreadCount: filteredMsgs.length,
                lines: summary.lines,
                actionCount: summary.actionCount,
              },
            });
          }

          case 'important_messages':
            return reply.send({
              ok: true,
              transcript,
              action: 'important_messages',
            });

          case 'translate_message': {
            const textToTranslate = activeMessage?.text ?? ctx.messages[0]?.text;
            if (!textToTranslate) {
              return reply.status(404).send({
                ok: false,
                error: 'NO_MESSAGE_TO_TRANSLATE',
                message: 'No message available to translate.',
              });
            }
            const translation = await aiService.translateMessage({
              text: textToTranslate,
              targetLanguage: intent.targetLanguage || 'English',
            });
            return reply.send({
              ok: true,
              transcript,
              action: 'translate_message',
              translation,
            });
          }

          case 'draft_reply': {
            const target = activeMessage
              ? activeMessage
              : ctx.messages[0]
                ? {
                    id: `${ctx.messages[0].chatId}:0`,
                    chatId: ctx.messages[0].chatId,
                    chatTitle: ctx.messages[0].chatTitle,
                    sender: ctx.messages[0].sender,
                    text: ctx.messages[0].text,
                  }
                : null;

            if (!target) {
              return reply.status(404).send({
                ok: false,
                error: 'NO_TARGET_MESSAGE',
                message: 'Select a message or monitor a chat before replying by voice.',
              });
            }

            const chatMsgs = ctx.messages.filter((m) => m.chatId === target.chatId);
            const draft = await aiService.suggestReply({
              chatTitle: target.chatTitle,
              sender: target.sender,
              incomingText: target.text,
              recentContext: chatMsgs,
              instruction: intent.replyInstruction || transcript,
            });
            return reply.send({
              ok: true,
              transcript,
              action: 'draft_reply',
              draftText: draft.replyText,
              targetMessage: target,
            });
          }

          case 'ask_context':
          default: {
            const answer = await aiService.answerContextQuestion({
              question: intent.question || transcript,
              authorizedMessages: ctx.messages,
            });
            return reply.send({
              ok: true,
              transcript,
              action: 'ask_context',
              answer,
            });
          }
        }
      } catch (err) {
        if (err instanceof AiServiceError) {
          return reply.status(err.statusCode).send({
            ok: false,
            error: err.code,
            message: err.message,
          });
        }
        throw err;
      }
    },
  );
}
