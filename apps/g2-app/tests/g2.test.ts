import assert from 'node:assert/strict';
import test from 'node:test';
import { OsEventTypeList } from '@evenrealities/even_hub_sdk';
import { DEMO_CHAT_SUMMARY, DEMO_MESSAGES } from '../src/data/demoData.ts';
import { uint8ToBase64 } from '../src/g2/audio.ts';
import { formatGlanceLines, formatListItemLabel, truncateUtf8Bytes } from '../src/g2/formatter.ts';
import { normalizeEvenHubEvent } from '../src/g2/input.ts';
import { buildG2Layout } from '../src/g2/screens.ts';
import type { CopilotState, ScreenId } from '../src/types/copilot.ts';

const encoder = new TextEncoder();

const ALL_SCREENS: ScreenId[] = [
  'welcome',
  'telegram_connect',
  'pairing',
  'overview',
  'important_messages',
  'message_detail',
  'ai_summary',
  'reply_suggestion',
  'voice_recording',
  'confirmation',
  'success',
  'error',
];

function makeBaseState(screen: ScreenId): CopilotState {
  return {
    screen,
    history: [],
    connectionMode: 'demo',
    backendHealthy: true,
    backendStatusLabel: 'OK (DB: ok)',
    pairingCode: 'G2-7492',
    setupUrl: 'http://localhost:3001/setup',
    deviceLabel: 'G2 Simulator',
    summary: DEMO_CHAT_SUMMARY,
    messages: DEMO_MESSAGES,
    selectedMessageIndex: 0,
    activeDraft: {
      messageId: 'demo-1',
      chatId: 'demo-work',
      chatTitle: 'Work Group',
      sender: 'John',
      incomingPreview: 'Can you confirm tomorrow?',
      draftText: 'Yes, tomorrow at 10:30 works for me.',
      source: 'ai',
      variantIndex: 0,
    },
    voiceMode: 'command',
    voiceTranscript: '',
    isRecording: screen === 'voice_recording',
    isProcessingVoice: false,
    recordingSeconds: 2,
    lastSentSummary: 'Sent to Work Group: "Yes, tomorrow works."',
    error: {
      title: 'OFFLINE',
      detail: 'Backend unreachable.',
      recoverableTo: 'overview',
    },
  };
}

test('truncateUtf8Bytes respects multi-byte boundaries and byte budget', () => {
  const input = 'Hello 🚀🚀🚀 world this is a very long Telegram message preview that exceeds sixty-three bytes';
  const out = truncateUtf8Bytes(input, 60);
  assert.ok(encoder.encode(out).length <= 60);
  assert.ok(!out.includes('\uFFFD'));
});

test('formatGlanceLines constrains lines and width', () => {
  const lines = formatGlanceLines(
    'This is a long message from Sarah asking whether you can approve the Q4 document before noon today.',
    3,
    38,
  );
  assert.ok(lines.length <= 3);
  for (const line of lines) {
    assert.ok(line.length <= 38);
  }
});

test('normalizeEvenHubEvent resolves undefined CLICK_EVENT inside active envelope only', () => {
  const sysClick = normalizeEvenHubEvent({ sysEvent: {} } as never);
  assert.deepEqual(sysClick, { type: 'click', source: 'Hardware' });

  const listClickZero = normalizeEvenHubEvent({
    listEvent: { containerID: 4, containerName: 'list' },
  } as never);
  assert.deepEqual(listClickZero, { type: 'click', listIndex: 0, source: 'Hardware' });

  const doubleClick = normalizeEvenHubEvent({
    sysEvent: { eventType: OsEventTypeList.DOUBLE_CLICK_EVENT },
  } as never);
  assert.deepEqual(doubleClick, { type: 'double_click', source: 'Hardware' });

  const scrollDown = normalizeEvenHubEvent({
    textEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
  } as never);
  assert.deepEqual(scrollDown, { type: 'scroll_down', listIndex: undefined, source: 'Hardware' });
});

test('all 12 screens satisfy Even Hub SDK container and byte limits', () => {
  for (const screen of ALL_SCREENS) {
    const layout = buildG2Layout(makeBaseState(screen));
    assert.ok(encoder.encode(layout.header).length <= 900, `${screen} header too large`);
    assert.ok(encoder.encode(layout.footer).length <= 900, `${screen} footer too large`);

    if (layout.kind === 'text') {
      assert.ok(encoder.encode(layout.body).length <= 950, `${screen} body too large`);
    } else if (layout.kind === 'list') {
      assert.ok(layout.items.length >= 1 && layout.items.length <= 20, `${screen} list count`);
      for (const item of layout.items) {
        assert.ok(encoder.encode(formatListItemLabel(item)).length <= 63, `${screen} item > 63 bytes`);
      }
    } else {
      assert.ok(encoder.encode(layout.preview).length <= 950, `${screen} preview too large`);
      assert.ok(layout.items.length >= 1 && layout.items.length <= 20, `${screen} split list count`);
      for (const item of layout.items) {
        assert.ok(encoder.encode(formatListItemLabel(item)).length <= 63, `${screen} split item > 63 bytes`);
      }
    }
  }
});

test('uint8ToBase64 encodes large PCM buffer accurately', () => {
  const sample = new Uint8Array(6400);
  for (let i = 0; i < sample.length; i += 1) {
    sample[i] = i & 0xff;
  }
  const b64 = uint8ToBase64(sample);
  const decoded = Buffer.from(b64, 'base64');
  assert.equal(decoded.length, sample.length);
  assert.equal(decoded[1234], sample[1234]);
});
