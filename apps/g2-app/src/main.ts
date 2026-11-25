import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import { CopilotController } from './app/controller';
import { G2DisplayEngine } from './g2/display';
import { normalizeEvenHubEvent } from './g2/input';
import type { ScreenId } from './types/copilot';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';

const statusEl = document.getElementById('status');
const mirrorHdr = document.getElementById('mirror-hdr');
const mirrorBody = document.getElementById('mirror-body');
const mirrorFtr = document.getElementById('mirror-ftr');
const screenButtonsEl = document.getElementById('screen-buttons');

const SCREENS: Array<{ id: ScreenId; label: string }> = [
  { id: 'welcome', label: '1.Welcome' },
  { id: 'telegram_connect', label: '2.Connect' },
  { id: 'pairing', label: '3.Pairing' },
  { id: 'overview', label: '4.Overview' },
  { id: 'important_messages', label: '5.Messages' },
  { id: 'message_detail', label: '6.Detail' },
  { id: 'ai_summary', label: '7.Summary' },
  { id: 'reply_suggestion', label: '8.Reply' },
  { id: 'voice_recording', label: '9.Voice' },
  { id: 'confirmation', label: '10.Confirm' },
  { id: 'success', label: '11.Success' },
  { id: 'error', label: '12.Error' },
];

const bridge = await waitForEvenAppBridge();
const display = new G2DisplayEngine(bridge);
const controller = new CopilotController(display, bridge, BACKEND_URL);

controller.subscribe((state, layout) => {
  if (statusEl) {
    statusEl.textContent = `${state.screen} · ${state.connectionMode.toUpperCase()} · ${state.backendStatusLabel}`;
  }
  if (mirrorHdr) mirrorHdr.textContent = layout.header;
  if (mirrorFtr) mirrorFtr.textContent = layout.footer;
  if (mirrorBody) {
    if (layout.kind === 'text') {
      mirrorBody.textContent = layout.body;
    } else if (layout.kind === 'list') {
      mirrorBody.textContent = layout.items.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
    } else {
      const listText = layout.items.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
      mirrorBody.textContent = `${layout.preview}\n\n${listText}`;
    }
  }
});

if (screenButtonsEl) {
  for (const item of SCREENS) {
    const btn = document.createElement('button');
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      void controller.jumpToScreen(item.id);
    });
    screenButtonsEl.appendChild(btn);
  }
}

await controller.init();

const unsubscribe = bridge.onEvenHubEvent((event) => {
  const action = normalizeEvenHubEvent(event);
  if (!action) return;
  if (action.type === 'system_exit') {
    unsubscribe();
  }
  void controller.handleHardwareAction(action);
});
