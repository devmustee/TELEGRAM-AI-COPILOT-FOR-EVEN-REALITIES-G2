import type { ChatSummary, ImportantMessage } from '../types/copilot';

// Clearly labeled Phase 3 demo data used strictly for simulator UI verification
// until Phase 4 (Telegram MTProto) and Phase 5 (OpenAI) are connected.
export const DEMO_CHAT_SUMMARY: ChatSummary = {
  chatTitle: 'WORK GROUP [DEMO]',
  unreadCount: 3,
  lines: [
    'Meeting moved to 10:30.',
    'John needs your approval.',
    'Sarah shared the Q4 spec.',
  ],
  actionCount: 2,
};

export const DEMO_MESSAGES: ImportantMessage[] = [
  {
    id: 'demo-1',
    chatId: 'demo-work',
    chatTitle: 'Work Group',
    sender: 'John',
    timestampLabel: '2m',
    text: 'Can you confirm whether we are meeting tomorrow at 10:30?',
    urgency: 'urgent',
    needsReply: true,
  },
  {
    id: 'demo-2',
    chatId: 'demo-work',
    chatTitle: 'Work Group',
    sender: 'Sarah',
    timestampLabel: '9m',
    text: 'Shared the updated launch checklist. Please approve section 3 before noon.',
    urgency: 'action',
    needsReply: true,
  },
  {
    id: 'demo-3',
    chatId: 'demo-founders',
    chatTitle: 'Founders DM',
    sender: 'Alex',
    timestampLabel: '18m',
    text: 'Demo video script is ready for your quick review.',
    urgency: 'info',
    needsReply: false,
  },
];

export const DEMO_REPLY_VARIANTS = [
  'Yes, tomorrow at 10:30 works for me.',
  'Confirmed for 10:30 tomorrow. See you then.',
  'Works for me — let us lock 10:30 tomorrow.',
];
