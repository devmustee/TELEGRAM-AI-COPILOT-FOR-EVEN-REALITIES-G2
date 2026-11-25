import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../src/db/pool.js';
import { buildServer } from '../src/index.js';
import {
  AiCopilotService,
  clampG2Lines,
  clampReplyText,
} from '../src/services/aiService.js';

test('clampG2Lines enforces max 3 lines and max 38 chars per line', () => {
  const lines = clampG2Lines(
    [
      'Meeting moved to 10:30 tomorrow morning in Conference Room B with the full team.',
      'John needs your approval on the Q4 product launch checklist before 12:00.',
      'Sarah shared the architecture document.',
      'Extra fourth line that must be dropped.',
    ],
    3,
    38,
  );
  assert.equal(lines.length, 3);
  for (const line of lines) {
    assert.ok(line.length <= 38, `Line exceeded 38 chars: ${line}`);
  }

  const longReply = clampReplyText('Sure, I can definitely review that document and get back to you right after the 10:30 meeting tomorrow morning with full notes.', 115);
  assert.ok(longReply.length <= 115);
});

test('AiCopilotService parses and clamps summary, reply, Q&A, translation, and intent', async () => {
  const service = new AiCopilotService(() => ({
    async completeJson(systemPrompt) {
      if (systemPrompt.includes('actionItems')) {
        return JSON.stringify({
          lines: [
            'Meeting moved to 10:30 tomorrow with engineering.',
            'John requested Q4 budget approval today.',
            'Sarah posted updated launch spec.',
            'Fourth line omitted.',
          ],
          actionCount: 2,
          dates: ['Tomorrow 10:30'],
          actionItems: ['Approve Q4 budget'],
          questions: ['Confirm tomorrow 10:30?'],
        });
      }
      if (systemPrompt.includes('draft concise, natural Telegram replies')) {
        return JSON.stringify({
          replyText: 'Yes, tomorrow at 10:30 works for me.',
          tone: 'polite',
        });
      }
      if (systemPrompt.includes('Answer the user question strictly')) {
        return JSON.stringify({
          answerLines: ['Meeting is at 10:30 tomorrow.', 'Confirmed by John.'],
          citedSender: 'John',
          citedChat: 'Work Group',
        });
      }
      if (systemPrompt.includes('Translate the Telegram message')) {
        return JSON.stringify({
          translatedLines: ['Please confirm if we meet tomorrow.'],
          detectedLanguage: 'Spanish',
          targetLanguage: 'English',
        });
      }
      return JSON.stringify({
        intent: 'ask_context',
        question: 'What time is the meeting?',
      });
    },
  }));

  const sampleMessages = [
    {
      chatId: 'c1',
      chatTitle: 'Work Group',
      sender: 'John',
      text: 'Meeting moved to 10:30 tomorrow. Can you confirm?',
      receivedAt: new Date().toISOString(),
    },
  ];

  const summary = await service.summarizeMessages({
    chatTitle: 'Work Group',
    messages: sampleMessages,
  });
  assert.equal(summary.chatTitle, 'WORK GROUP');
  assert.ok(summary.lines.length <= 3);
  assert.equal(summary.actionCount, 2);

  const reply = await service.suggestReply({
    chatTitle: 'Work Group',
    sender: 'John',
    incomingText: 'Can you confirm tomorrow?',
    recentContext: sampleMessages,
  });
  assert.equal(reply.replyText, 'Yes, tomorrow at 10:30 works for me.');

  const answer = await service.answerContextQuestion({
    question: 'What time is the meeting?',
    authorizedMessages: sampleMessages,
  });
  assert.deepEqual(answer.answerLines, ['Meeting is at 10:30 tomorrow.', 'Confirmed by John.']);

  const translated = await service.translateMessage({
    text: 'Por favor confirma si nos vemos mañana.',
    targetLanguage: 'English',
  });
  assert.equal(translated.detectedLanguage, 'Spanish');
  assert.equal(translated.translatedLines[0], 'Please confirm if we meet tomorrow.');

  const intent = await service.detectCommandIntent({
    transcript: 'What time is the meeting?',
    hasActiveMessage: false,
    availableChats: ['Work Group'],
  });
  assert.equal(intent.intent, 'ask_context');
});

test('AI routes require authentication and return 503 cleanly if OPENAI_API_KEY is unset', async () => {
  const app = await buildServer();
  try {
    const unauth = await app.inject({
      method: 'POST',
      url: '/api/ai/ask',
      payload: { question: 'What did John ask?' },
    });
    assert.equal(unauth.statusCode, 401);

    const pairRes = await app.inject({ method: 'POST', url: '/api/pair/init' });
    const { code, sessionToken } = pairRes.json() as { code: string; sessionToken: string };
    await app.inject({ method: 'POST', url: '/api/pair/claim', payload: { code } });

    const translateRes = await app.inject({
      method: 'POST',
      url: '/api/ai/translate',
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: { text: 'Hola mundo', targetLanguage: 'English' },
    });
    // Without OPENAI_API_KEY configured in test env, returns 503 OPENAI_NOT_CONFIGURED (or 200 if key is set)
    assert.ok([200, 503].includes(translateRes.statusCode));
  } finally {
    await app.close();
  }
});

test.after(async () => {
  await pool.end();
});
