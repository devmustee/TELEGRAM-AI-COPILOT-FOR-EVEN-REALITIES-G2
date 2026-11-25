export interface ScorableMessage {
  id: string;
  chatId: string;
  chatTitle: string;
  sender: string;
  text: string;
  receivedAt: Date;
  priorityWeight: number;
  isOutgoing: boolean;
}

export interface ScoredMessage extends ScorableMessage {
  importanceScore: number;
  urgency: 'urgent' | 'action' | 'info';
  needsReply: boolean;
  timestampLabel: string;
}

const URGENT_KEYWORDS = [
  'urgent',
  'asap',
  'immediately',
  'emergency',
  'now',
  'deadline',
  'approve',
  'approval',
  'confirm',
  'tonight',
  'today',
];

const ACTION_KEYWORDS = [
  'meeting',
  'schedule',
  'tomorrow',
  'review',
  'check',
  'send',
  'reply',
  'call',
  'please',
  'need',
  'can you',
  'could you',
  'when',
  'where',
];

export function formatRelativeTime(date: Date): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

export function scoreMessage(msg: ScorableMessage): ScoredMessage {
  const lower = msg.text.toLowerCase();
  let score = Math.max(1, msg.priorityWeight) * 10;

  if (msg.isOutgoing) {
    score -= 25;
  }

  const hasQuestion = msg.text.includes('?');
  if (hasQuestion) score += 25;

  let urgentHits = 0;
  for (const kw of URGENT_KEYWORDS) {
    if (lower.includes(kw)) urgentHits += 1;
  }
  score += Math.min(30, urgentHits * 12);

  let actionHits = 0;
  for (const kw of ACTION_KEYWORDS) {
    if (lower.includes(kw)) actionHits += 1;
  }
  score += Math.min(20, actionHits * 7);

  // Recency boost within the last 6 hours.
  const ageMinutes = Math.max(0, (Date.now() - msg.receivedAt.getTime()) / 60_000);
  if (ageMinutes < 30) score += 15;
  else if (ageMinutes < 180) score += 8;
  else if (ageMinutes < 360) score += 3;

  const urgency: ScoredMessage['urgency'] =
    !msg.isOutgoing && (urgentHits > 0 || score >= 60)
      ? 'urgent'
      : !msg.isOutgoing && (hasQuestion || actionHits > 0 || score >= 40)
        ? 'action'
        : 'info';

  const needsReply = !msg.isOutgoing && (hasQuestion || urgency !== 'info');

  return {
    ...msg,
    importanceScore: score,
    urgency,
    needsReply,
    timestampLabel: formatRelativeTime(msg.receivedAt),
  };
}

export function buildDeterministicDigest(
  messages: ScoredMessage[],
): {
  chatTitle: string;
  unreadCount: number;
  lines: string[];
  actionCount: number;
} {
  if (messages.length === 0) {
    return {
      chatTitle: 'MONITORED CHATS',
      unreadCount: 0,
      lines: [
        'No new messages in monitored chats.',
        'All caught up.',
      ],
      actionCount: 0,
    };
  }

  const top = [...messages].sort((a, b) => b.importanceScore - a.importanceScore);
  const topChat = top[0].chatTitle;
  const actionCount = top.filter((m) => m.needsReply).length;
  const lines = top.slice(0, 3).map((m) => {
    const compact = m.text.replace(/\s+/g, ' ').trim();
    const snippet = compact.length > 26 ? `${compact.slice(0, 23)}...` : compact;
    return `${m.sender}: ${snippet}`;
  });

  return {
    chatTitle: topChat.toUpperCase(),
    unreadCount: messages.length,
    lines,
    actionCount,
  };
}
