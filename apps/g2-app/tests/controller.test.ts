import assert from 'node:assert/strict';
import test from 'node:test';
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';
import { CopilotController } from '../src/app/controller.ts';
import { G2DisplayEngine, type G2Layout } from '../src/g2/display.ts';
import type { ScreenId } from '../src/types/copilot.ts';

function createMockBridge(): { bridge: EvenAppBridge; calls: { exitCount: number; audioControl: boolean[] } } {
  const store = new Map<string, string>();
  const calls = {
    exitCount: 0,
    audioControl: [] as boolean[],
  };

  const bridge = {
    createStartUpPageContainer: async () => 1,
    rebuildPageContainer: async () => 1,
    textContainerUpgrade: async () => 1,
    shutDownPageContainer: async () => {
      calls.exitCount += 1;
      return 1;
    },
    audioControl: async (enable: boolean) => {
      calls.audioControl.push(enable);
      return 1;
    },
    getLocalStorage: async (key: string) => store.get(key) ?? '',
    setLocalStorage: async (key: string, val: string) => {
      store.set(key, val);
      return 1;
    },
  } as unknown as EvenAppBridge;

  return { bridge, calls };
}

class MockDisplayEngine extends G2DisplayEngine {
  public renderedLayouts: G2Layout[] = [];
  public exited = false;

  constructor(bridge: EvenAppBridge) {
    super(bridge);
  }

  override async render(layout: G2Layout): Promise<void> {
    this.renderedLayouts.push(layout);
  }

  override async exitApp(): Promise<void> {
    this.exited = true;
    await super.exitApp();
  }
}

function createTestHarness() {
  const { bridge, calls } = createMockBridge();
  const display = new MockDisplayEngine(bridge);
  const controller = new CopilotController(display, bridge, 'http://127.0.0.1:9999');
  return { controller, display, bridge, calls };
}

test('CopilotController initializes to welcome screen and renders layout', async () => {
  const { controller, display } = createTestHarness();
  await controller.init();

  const state = controller.getState();
  assert.equal(state.screen, 'welcome');
  assert.equal(state.backendHealthy, false); // Port 9999 is offline
  assert.equal(display.renderedLayouts.length, 1);
  assert.ok(display.renderedLayouts[0].header.includes('TELEGRAM'));
});

test('CopilotController transitions Welcome -> Connect -> Overview (Demo mode)', async () => {
  const { controller } = createTestHarness();
  await controller.init();

  // Click on Welcome -> enters telegram_connect
  await controller.handleHardwareAction({ type: 'click', listIndex: 0, source: 'Hardware' });
  assert.equal(controller.getState().screen, 'telegram_connect');

  // Select Demo Preview (item 1) -> enters overview with demo dataset
  await controller.handleHardwareAction({ type: 'click', listIndex: 1, source: 'Hardware' });
  const state = controller.getState();
  assert.equal(state.screen, 'overview');
  assert.equal(state.connectionMode, 'demo');
  assert.ok(state.messages.length > 0);
  assert.ok(state.summary.chatTitle.length > 0);
});

test('CopilotController executes full Read-to-Write flow: Overview -> Messages -> Detail -> Suggest -> Confirm -> Success', async () => {
  const { controller } = createTestHarness();
  await controller.init();

  // Enter demo mode
  await controller.handleHardwareAction({ type: 'click', listIndex: 0, source: 'Hardware' });
  await controller.handleHardwareAction({ type: 'click', listIndex: 1, source: 'Hardware' });
  assert.equal(controller.getState().screen, 'overview');

  // Overview -> Important Messages (item 0)
  await controller.handleHardwareAction({ type: 'click', listIndex: 0, source: 'Hardware' });
  assert.equal(controller.getState().screen, 'important_messages');

  // Important Messages -> Message Detail (item 0)
  await controller.handleHardwareAction({ type: 'click', listIndex: 0, source: 'Hardware' });
  assert.equal(controller.getState().screen, 'message_detail');
  assert.equal(controller.getState().selectedMessageIndex, 0);

  // Scroll down in Message Detail -> advances message index
  const prevIndex = controller.getState().selectedMessageIndex;
  await controller.handleHardwareAction({ type: 'scroll_down', source: 'Hardware' });
  assert.equal(controller.getState().selectedMessageIndex, (prevIndex + 1) % controller.getState().messages.length);

  // Message Detail -> Suggest Reply (item 0)
  await controller.handleHardwareAction({ type: 'click', listIndex: 0, source: 'Hardware' });
  assert.equal(controller.getState().screen, 'reply_suggestion');
  assert.ok(controller.getState().activeDraft !== null);

  // Regenerate reply draft (item 1) -> changes variant index
  const initialVariant = controller.getState().activeDraft?.variantIndex ?? 0;
  await controller.handleHardwareAction({ type: 'click', listIndex: 1, source: 'Hardware' });
  assert.equal(controller.getState().activeDraft?.variantIndex, initialVariant + 1);

  // Reply Suggestion -> Approve & Send (item 0) -> Confirmation screen
  await controller.handleHardwareAction({ type: 'click', listIndex: 0, source: 'Hardware' });
  assert.equal(controller.getState().screen, 'confirmation');

  // In Confirmation, select Edit/Back (item 1) -> returns to Reply Suggestion
  await controller.handleHardwareAction({ type: 'click', listIndex: 1, source: 'Hardware' });
  assert.equal(controller.getState().screen, 'reply_suggestion');

  // Back to Confirmation -> Confirm Send (item 0)
  await controller.handleHardwareAction({ type: 'click', listIndex: 0, source: 'Hardware' });
  assert.equal(controller.getState().screen, 'confirmation');
  await controller.handleHardwareAction({ type: 'click', listIndex: 0, source: 'Hardware' });

  // Guardrail verified: transitions to Success screen and sets lastSentSummary
  assert.equal(controller.getState().screen, 'success');
  assert.equal(controller.getState().activeDraft, null);
  assert.ok(controller.getState().lastSentSummary.includes('DEMO'));

  // Click on Success -> returns to Overview
  await controller.handleHardwareAction({ type: 'click', listIndex: 0, source: 'Hardware' });
  assert.equal(controller.getState().screen, 'overview');
});

test('CopilotController back-stack navigation and exitApp on root screens', async () => {
  const { controller, display, calls } = createTestHarness();
  await controller.init();

  // Double-click on Welcome screen exits the app
  await controller.handleHardwareAction({ type: 'double_click', source: 'Hardware' });
  assert.equal(display.exited, true);
  assert.equal(calls.exitCount, 1);

  // Enter demo mode
  await controller.handleHardwareAction({ type: 'click', listIndex: 0, source: 'Hardware' });
  await controller.handleHardwareAction({ type: 'click', listIndex: 1, source: 'Hardware' });
  assert.equal(controller.getState().screen, 'overview');

  // Overview -> Important Messages
  await controller.handleHardwareAction({ type: 'click', listIndex: 0, source: 'Hardware' });
  assert.equal(controller.getState().screen, 'important_messages');

  // Double click in Important Messages -> returns to Overview
  await controller.handleHardwareAction({ type: 'double_click', source: 'Hardware' });
  assert.equal(controller.getState().screen, 'overview');

  // Double click on Overview -> exits app
  await controller.handleHardwareAction({ type: 'double_click', source: 'Hardware' });
  assert.equal(calls.exitCount, 2);
});

test('CopilotController voice recording lifecycle and hardware audio frames', async () => {
  const { controller, calls } = createTestHarness();
  await controller.init();

  // Jump to voice recording
  await controller.jumpToScreen('voice_recording');
  assert.equal(controller.getState().screen, 'voice_recording');
  assert.equal(controller.getState().isRecording, true);
  assert.ok(calls.audioControl.includes(true));

  // Push PCM audio frame
  const pcmFrame = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
  await controller.handleHardwareAction({ type: 'audio', audioPcm: pcmFrame });

  // Cancel recording via double click -> cleanly restores state
  await controller.handleHardwareAction({ type: 'double_click', source: 'Hardware' });
  assert.equal(controller.getState().isRecording, false);
  assert.ok(calls.audioControl.includes(false));
});

test('CopilotController handles error state and recovery', async () => {
  const { controller } = createTestHarness();
  await controller.init();

  // Force an error state
  await controller.jumpToScreen('error');
  assert.equal(controller.getState().screen, 'error');
  assert.ok(controller.getState().error !== null);

  // Select Retry (item 0) -> recovers to overview
  await controller.handleHardwareAction({ type: 'click', listIndex: 0, source: 'Hardware' });
  assert.equal(controller.getState().screen, 'overview');
  assert.equal(controller.getState().error, null);
});

test('CopilotController jumpToScreen reaches all 12 screens and renders valid layouts', async () => {
  const { controller, display } = createTestHarness();
  await controller.init();

  const ALL_12_SCREENS: ScreenId[] = [
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

  for (const screen of ALL_12_SCREENS) {
    display.renderedLayouts = [];
    await controller.jumpToScreen(screen);
    assert.equal(controller.getState().screen, screen, `Failed to jump to screen ${screen}`);
    assert.ok(display.renderedLayouts.length > 0, `Screen ${screen} did not trigger render`);
    const lastLayout = display.renderedLayouts[display.renderedLayouts.length - 1];
    assert.ok(lastLayout.header.length > 0, `Screen ${screen} has empty header`);
    assert.ok(lastLayout.footer.length > 0, `Screen ${screen} has empty footer`);
  }
});
