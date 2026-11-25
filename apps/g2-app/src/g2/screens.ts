import type { G2Layout } from './display';
import { formatGlanceLines } from './formatter';
import type { CopilotState, ImportantMessage } from '../types/copilot';

function urgencyTag(urgency: ImportantMessage['urgency']): string {
  if (urgency === 'urgent') return '[!]';
  if (urgency === 'action') return '[?]';
  return '[i]';
}

export function buildG2Layout(state: CopilotState): G2Layout {
  const modeTag =
    state.connectionMode === 'telegram'
      ? 'LIVE'
      : state.connectionMode === 'demo'
        ? 'DEMO'
        : 'OFFLINE';

  switch (state.screen) {
    case 'welcome':
      return {
        kind: 'text',
        header: `TELEGRAM AI COPILOT          [${modeTag}]`,
        body: [
          'Your Telegram intelligence,',
          'one glance away.',
          '',
          `Backend: ${state.backendStatusLabel}`,
        ].join('\n'),
        footer: 'Tap: Start  |  2x Tap: Exit',
      };

    case 'telegram_connect':
      return {
        kind: 'list',
        header: 'CONNECT TELEGRAM',
        items: [
          'Pair Phone Setup (/setup)',
          'Preview UI [DEMO DATA]',
          'Retry Backend Health',
        ],
        footer: 'Up/Dn: Move | Tap: Select | 2x: Back',
      };

    case 'pairing':
      return {
        kind: 'text',
        header: 'PAIR COMPANION BROWSER',
        body: [
          `PAIR CODE:  ${state.pairingCode}`,
          `Open: ${state.setupUrl}`,
          'Enter code & sign in to Telegram.',
          'Status: Waiting for confirmation...',
        ].join('\n'),
        footer: 'Tap: Check Status  |  2x Tap: Back',
      };

    case 'overview': {
      const urgentCount = state.messages.filter((m) => m.needsReply).length;
      return {
        kind: 'list',
        header: `${state.summary.chatTitle} · ${state.summary.unreadCount} NEW`,
        items: [
          `Important Messages (${state.messages.length}) · ${urgentCount} reply`,
          `AI Summary (${state.summary.actionCount} actions)`,
          'Voice Copilot (Ask / Reply)',
          'Connection & Pairing',
        ],
        footer: 'Up/Dn: Move | Tap: Open | 2x: Exit',
      };
    }

    case 'important_messages': {
      const items =
        state.messages.length > 0
          ? state.messages.map(
              (m) =>
                `${urgencyTag(m.urgency)} ${m.sender} (${m.timestampLabel}): ${m.text}`,
            )
          : ['No important messages right now.'];
      return {
        kind: 'list',
        header: `IMPORTANT (${state.messages.length})`,
        items,
        footer: 'Up/Dn: Select | Tap: Read | 2x: Back',
      };
    }

    case 'message_detail': {
      const msg = state.messages[state.selectedMessageIndex];
      if (!msg) {
        return {
          kind: 'text',
          header: 'MESSAGE DETAIL',
          body: 'No message selected.',
          footer: '2x Tap: Back',
        };
      }
      const lines = formatGlanceLines(msg.text, 4, 42);
      return {
        kind: 'split',
        header: `${msg.sender} · ${msg.chatTitle} · ${msg.timestampLabel}`,
        preview: lines.join('\n'),
        items: [
          'Suggest AI Reply',
          'AI Summary of Chat',
          'Translate Message',
          'Reply by Voice',
          'Next Message',
        ],
        footer: 'Tap: Action  |  2x Tap: Back',
      };
    }

    case 'ai_summary': {
      const summaryLines = state.summary.lines.slice(0, 3);
      return {
        kind: 'split',
        header: `AI SUMMARY · ${state.summary.chatTitle}`,
        preview: [
          ...summaryLines,
          `AI: ${state.summary.actionCount} items need attention.`,
        ].join('\n'),
        items: [
          'Open Important Messages',
          'Ask AI via Voice',
          'Back to Overview',
        ],
        footer: 'Tap: Select  |  2x Tap: Back',
      };
    }

    case 'reply_suggestion': {
      const draft = state.activeDraft;
      const previewLines = draft
        ? formatGlanceLines(draft.draftText, 3, 38)
        : ['No draft available.'];
      return {
        kind: 'split',
        header: draft
          ? `REPLY → ${draft.sender} [${draft.source === 'voice' ? 'VOICE' : 'AI'}]`
          : 'AI REPLY DRAFT',
        preview: previewLines.join('\n'),
        items: [
          'Approve & Confirm Send',
          'Regenerate Suggestion',
          'Edit with Voice',
          'Reject & Back',
        ],
        footer: 'Explicit confirm required | 2x: Back',
      };
    }

    case 'voice_recording': {
      const modeTitle =
        state.voiceMode === 'reply_edit' ? 'VOICE REPLY EDIT' : 'VOICE COPILOT';
      if (state.isProcessingVoice) {
        return {
          kind: 'text',
          header: `${modeTitle} [PROCESSING]`,
          body: [
            '● TRANSCRIBING AUDIO...',
            '',
            'Running speech-to-text',
            'and AI interpretation...',
          ].join('\n'),
          footer: 'Please wait...',
        };
      }
      const bars = ['|', '||', '|||', '||||', '|||', '||'][
        state.recordingSeconds % 6
      ];
      return {
        kind: 'text',
        header: `${modeTitle} [G2 MIC]`,
        body: [
          `● LISTENING ${bars} (${state.recordingSeconds}s)`,
          '',
          state.voiceMode === 'reply_edit'
            ? 'Speak your reply or edit instruction.'
            : 'Try: "Summarize work group"',
          state.voiceMode === 'reply_edit'
            ? 'e.g. "Say I will be 10 mins late"'
            : 'or:  "What did John ask me?"',
        ].join('\n'),
        footer: 'Tap: Finish & Process | 2x: Cancel',
      };
    }

    case 'confirmation': {
      const draft = state.activeDraft;
      const previewLines = draft
        ? formatGlanceLines(`"${draft.draftText}"`, 3, 38)
        : ['Nothing to confirm.'];
      return {
        kind: 'split',
        header: draft ? `CONFIRM SEND → ${draft.chatTitle}` : 'CONFIRM SEND',
        preview: previewLines.join('\n'),
        items: ['Confirm & Send Now', 'Cancel (Do Not Send)'],
        footer: 'Tap: Execute | 2x Tap: Cancel',
      };
    }

    case 'success':
      return {
        kind: 'text',
        header: 'ACTION COMPLETE',
        body: [
          '✓ CONFIRMED',
          '',
          ...formatGlanceLines(
            state.lastSentSummary || 'Message sent successfully.',
            3,
            40,
          ),
        ].join('\n'),
        footer: 'Tap: Overview | 2x Tap: Messages',
      };

    case 'error':
      return {
        kind: 'split',
        header: `ERROR · ${state.error?.title ?? 'CONNECTION'}`,
        preview: formatGlanceLines(
          state.error?.detail ?? 'Unable to reach backend service.',
          4,
          40,
        ).join('\n'),
        items: [
          'Retry',
          'Open Pairing Setup',
          'Return to Overview',
        ],
        footer: 'Tap: Select | 2x Tap: Back',
      };
  }
}
