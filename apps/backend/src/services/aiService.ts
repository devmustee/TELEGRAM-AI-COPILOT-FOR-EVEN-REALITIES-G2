import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '../config/env.js';

export class AiServiceError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 500) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface ContextMessageInput {
  chatId: string;
  chatTitle: string;
  sender: string;
  text: string;
  receivedAt: string;
}

export interface G2SummaryOutput {
  chatTitle: string;
  lines: string[];
  actionCount: number;
  dates: string[];
  actionItems: string[];
  questions: string[];
}

export interface ReplySuggestionOutput {
  replyText: string;
  tone: string;
}

export interface ContextAnswerOutput {
  answerLines: string[];
  citedSender?: string;
  citedChat?: string;
}

export interface TranslationOutput {
  translatedLines: string[];
  detectedLanguage: string;
  targetLanguage: string;
}

export type CommandIntentType =
  | 'summarize_chat'
  | 'important_messages'
  | 'draft_reply'
  | 'translate_message'
  | 'ask_context';

export interface CommandIntentOutput {
  intent: CommandIntentType;
  chatQuery?: string;
  replyInstruction?: string;
  targetLanguage?: string;
  question?: string;
}

export interface ChatCompletionRunner {
  completeJson(systemPrompt: string, userPrompt: string): Promise<string>;
}

const summarySchema = z.object({
  lines: z.array(z.string()).min(1).max(6),
  actionCount: z.number().int().min(0).max(99).default(0),
  dates: z.array(z.string()).max(5).default([]),
  actionItems: z.array(z.string()).max(5).default([]),
  questions: z.array(z.string()).max(5).default([]),
});

const replySchema = z.object({
  replyText: z.string().min(1),
  tone: z.string().default('concise'),
});

const answerSchema = z.object({
  answerLines: z.array(z.string()).min(1).max(6),
  citedSender: z.string().optional(),
  citedChat: z.string().optional(),
});

const translationSchema = z.object({
  translatedLines: z.array(z.string()).min(1).max(6),
  detectedLanguage: z.string().default('auto'),
  targetLanguage: z.string().default('English'),
});

const intentSchema = z.object({
  intent: z.enum([
    'summarize_chat',
    'important_messages',
    'draft_reply',
    'translate_message',
    'ask_context',
  ]),
  chatQuery: z.string().optional(),
  replyInstruction: z.string().optional(),
  targetLanguage: z.string().optional(),
  question: z.string().optional(),
});

/**
 * Enforces strict 576x288 Even G2 readability bounds: max 3 short lines, <= 38 chars each.
 */
export function clampG2Lines(
  rawLines: string[],
  maxLines = 3,
  maxCharsPerLine = 38,
): string[] {
  const cleaned = rawLines
    .flatMap((line) => line.split('\n'))
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (cleaned.length === 0) {
    return ['No details available.'];
  }

  const out: string[] = [];
  for (const line of cleaned) {
    if (out.length >= maxLines) break;
    if (line.length <= maxCharsPerLine) {
      out.push(line);
      continue;
    }
    const words = line.split(' ');
    let current = '';
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      if (candidate.length <= maxCharsPerLine) {
        current = candidate;
      } else {
        if (current) {
          out.push(current);
          if (out.length >= maxLines) break;
          current = w.slice(0, maxCharsPerLine);
        } else {
          out.push(w.slice(0, maxCharsPerLine));
          if (out.length >= maxLines) break;
          current = '';
        }
      }
    }
    if (out.length < maxLines && current) {
      out.push(current);
    }
  }

  return out.slice(0, maxLines);
}

export function clampReplyText(raw: string, maxChars = 115): string {
  const clean = raw.replace(/\s+/g, ' ').trim().replace(/^["']|["']$/g, '');
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars - 3).trimEnd()}...`;
}

function createOpenAiRunner(): ChatCompletionRunner {
  const apiKey = env.OPENAI_API_KEY.trim();
  if (!apiKey) {
    throw new AiServiceError(
      'OPENAI_NOT_CONFIGURED',
      'OPENAI_API_KEY is not configured in backend environment.',
      503,
    );
  }
  const client = new OpenAI({ apiKey });
  return {
    async completeJson(systemPrompt: string, userPrompt: string): Promise<string> {
      try {
        const res = await client.chat.completions.create({
          model: env.OPENAI_CHAT_MODEL,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });
        const content = res.choices[0]?.message?.content;
        if (!content) {
          throw new AiServiceError('AI_EMPTY_RESPONSE', 'OpenAI returned an empty response.', 502);
        }
        return content;
      } catch (err) {
        if (err instanceof AiServiceError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new AiServiceError('AI_UPSTREAM_ERROR', `OpenAI request failed: ${msg}`, 502);
      }
    },
  };
}

function parseJsonSafe<T>(raw: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new AiServiceError('AI_INVALID_JSON', 'AI response was not valid JSON.', 502);
  }
  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    throw new AiServiceError('AI_SCHEMA_MISMATCH', 'AI response did not match expected format.', 502);
  }
  return parsed.data;
}

export class AiCopilotService {
  private readonly runnerFactory: () => ChatCompletionRunner;

  constructor(runnerFactory: () => ChatCompletionRunner = createOpenAiRunner) {
    this.runnerFactory = runnerFactory;
  }

  async summarizeMessages(params: {
    chatTitle: string;
    messages: ContextMessageInput[];
  }): Promise<G2SummaryOutput> {
    if (params.messages.length === 0) {
      return {
        chatTitle: params.chatTitle.toUpperCase(),
        lines: ['No recent messages found.', 'All caught up.'],
        actionCount: 0,
        dates: [],
        actionItems: [],
        questions: [],
      };
    }

    const runner = this.runnerFactory();
    const systemPrompt = [
      'You are Telegram AI Copilot for Even Realities G2 smart glasses (576x288 monochrome display).',
      'Return strict JSON with keys: lines (string[]), actionCount (number), dates (string[]), actionItems (string[]), questions (string[]).',
      'CRITICAL DISPLAY RULE: lines must have 2 or 3 ultra-concise bullet/sentence lines, max 36 characters each.',
      'Highlight urgent items, dates/times, action items, and questions directed at the user.',
    ].join(' ');

    const transcript = params.messages
      .slice(0, 25)
      .map((m) => `[${m.receivedAt}] ${m.chatTitle} | ${m.sender}: ${m.text}`)
      .join('\n');

    const raw = await runner.completeJson(
      systemPrompt,
      `Chat focus: ${params.chatTitle}\nMessages:\n${transcript}`,
    );
    const parsed = parseJsonSafe(raw, summarySchema);

    return {
      chatTitle: params.chatTitle.toUpperCase(),
      lines: clampG2Lines(parsed.lines, 3, 38),
      actionCount: parsed.actionCount,
      dates: parsed.dates.slice(0, 4),
      actionItems: parsed.actionItems.slice(0, 4),
      questions: parsed.questions.slice(0, 4),
    };
  }

  async suggestReply(params: {
    chatTitle: string;
    sender: string;
    incomingText: string;
    recentContext: ContextMessageInput[];
    variationIndex?: number;
    instruction?: string;
  }): Promise<ReplySuggestionOutput> {
    const runner = this.runnerFactory();
    const variationHint =
      params.variationIndex && params.variationIndex > 0
        ? `Generate alternative wording variant #${params.variationIndex + 1} (distinct from previous phrasing).`
        : 'Generate the clearest, most helpful reply.';

    const systemPrompt = [
      'You draft concise, natural Telegram replies for smart glasses.',
      'Return strict JSON with keys: replyText (string), tone (string).',
      'Keep replyText under 110 characters, polite, accurate to the conversation context, and ready to send.',
    ].join(' ');

    const contextBlock = params.recentContext
      .slice(0, 8)
      .map((m) => `${m.sender}: ${m.text}`)
      .join('\n');

    const userPrompt = [
      `Chat: ${params.chatTitle}`,
      `Sender: ${params.sender}`,
      `Incoming message: ${params.incomingText}`,
      contextBlock ? `Recent context:\n${contextBlock}` : '',
      params.instruction ? `User instruction: ${params.instruction}` : '',
      variationHint,
    ]
      .filter(Boolean)
      .join('\n\n');

    const raw = await runner.completeJson(systemPrompt, userPrompt);
    const parsed = parseJsonSafe(raw, replySchema);

    return {
      replyText: clampReplyText(parsed.replyText, 115),
      tone: parsed.tone,
    };
  }

  async answerContextQuestion(params: {
    question: string;
    authorizedMessages: ContextMessageInput[];
  }): Promise<ContextAnswerOutput> {
    if (params.authorizedMessages.length === 0) {
      return {
        answerLines: ['No authorized messages', 'available to answer this.'],
      };
    }

    const runner = this.runnerFactory();
    const systemPrompt = [
      'Answer the user question strictly from the provided authorized Telegram messages.',
      'If the answer is not in the messages, say so concisely.',
      'Return strict JSON with keys: answerLines (string[]), citedSender (optional string), citedChat (optional string).',
      'CRITICAL: answerLines must be 1 to 3 short lines, max 36 characters per line, for G2 glasses.',
    ].join(' ');

    const history = params.authorizedMessages
      .slice(0, 30)
      .map((m) => `[${m.receivedAt}] ${m.chatTitle} | ${m.sender}: ${m.text}`)
      .join('\n');

    const raw = await runner.completeJson(
      systemPrompt,
      `Question: ${params.question}\n\nAuthorized messages:\n${history}`,
    );
    const parsed = parseJsonSafe(raw, answerSchema);

    return {
      answerLines: clampG2Lines(parsed.answerLines, 3, 38),
      citedSender: parsed.citedSender,
      citedChat: parsed.citedChat,
    };
  }

  async translateMessage(params: {
    text: string;
    targetLanguage?: string;
  }): Promise<TranslationOutput> {
    const targetLanguage = params.targetLanguage?.trim() || 'English';
    const runner = this.runnerFactory();

    const systemPrompt = [
      'Translate the Telegram message concisely for smart glasses.',
      'Return strict JSON with keys: translatedLines (string[]), detectedLanguage (string), targetLanguage (string).',
      'CRITICAL: translatedLines must be 1 to 3 short lines, max 36 characters each.',
    ].join(' ');

    const raw = await runner.completeJson(
      systemPrompt,
      `Target language: ${targetLanguage}\nMessage:\n${params.text}`,
    );
    const parsed = parseJsonSafe(raw, translationSchema);

    return {
      translatedLines: clampG2Lines(parsed.translatedLines, 3, 38),
      detectedLanguage: parsed.detectedLanguage,
      targetLanguage: parsed.targetLanguage || targetLanguage,
    };
  }

  async detectCommandIntent(params: {
    transcript: string;
    hasActiveMessage: boolean;
    availableChats: string[];
  }): Promise<CommandIntentOutput> {
    const runner = this.runnerFactory();
    const systemPrompt = [
      'Classify a voice command for Telegram AI Copilot on smart glasses.',
      'Return strict JSON with keys: intent, chatQuery (optional), replyInstruction (optional), targetLanguage (optional), question (optional).',
      'Allowed intent values: summarize_chat, important_messages, draft_reply, translate_message, ask_context.',
    ].join(' ');

    const userPrompt = [
      `Transcript: "${params.transcript}"`,
      `Has active selected message: ${params.hasActiveMessage}`,
      `Available monitored chats: ${params.availableChats.join(', ') || 'none'}`,
    ].join('\n');

    const raw = await runner.completeJson(systemPrompt, userPrompt);
    return parseJsonSafe(raw, intentSchema);
  }
}

export const aiService = new AiCopilotService();
