import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';
import { ApiError, CopilotApiClient } from '../api/client';
import {
  DEMO_CHAT_SUMMARY,
  DEMO_MESSAGES,
  DEMO_REPLY_VARIANTS,
} from '../data/demoData';
import { G2AudioRecorder, uint8ToBase64 } from '../g2/audio';
import type { G2DisplayEngine, G2Layout } from '../g2/display';
import type { HardwareAction } from '../g2/input';
import { buildG2Layout } from '../g2/screens';
import type { CopilotState, ScreenId, VoiceMode } from '../types/copilot';

type StateListener = (state: CopilotState, layout: G2Layout) => void;

const SESSION_STORAGE_KEY = 'copilot_session_token';

export class CopilotController {
  private readonly display: G2DisplayEngine;
  private readonly bridge: EvenAppBridge;
  private readonly api: CopilotApiClient;
  private readonly recorder: G2AudioRecorder;
  private readonly listeners = new Set<StateListener>();
  private recordingTimer: number | null = null;
  private pairingPollTimer: number | null = null;
  private state: CopilotState;

  constructor(display: G2DisplayEngine, bridge: EvenAppBridge, backendUrl: string) {
    this.display = display;
    this.bridge = bridge;
    this.api = new CopilotApiClient(backendUrl);
    this.recorder = new G2AudioRecorder(bridge);
    this.state = {
      screen: 'welcome',
      history: [],
      connectionMode: 'disconnected',
      backendHealthy: false,
      backendStatusLabel: 'checking...',
      pairingCode: '------',
      setupUrl: `${backendUrl}/setup`,
      deviceLabel: 'Even G2',
      summary: DEMO_CHAT_SUMMARY,
      messages: DEMO_MESSAGES,
      selectedMessageIndex: 0,
      activeDraft: null,
      voiceMode: 'command',
      voiceTranscript: '',
      isRecording: false,
      isProcessingVoice: false,
      recordingSeconds: 0,
      lastSentSummary: '',
      error: null,
    };
  }

  getState(): CopilotState {
    return this.state;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async init(): Promise<void> {
    await this.checkBackendHealth(false);
    await this.restoreExistingSession();
    await this.render();
  }

  async checkBackendHealth(navigateOnFailure = false): Promise<void> {
    try {
      const data = await this.api.checkHealth();
      this.state.backendHealthy = Boolean(data.ok);
      this.state.backendStatusLabel = data.ok
        ? `OK (DB: ${data.db ?? 'ok'})`
        : 'Unhealthy';
    } catch {
      this.state.backendHealthy = false;
      this.state.backendStatusLabel = 'Offline (Demo UI available)';
      if (navigateOnFailure) {
        this.showError(
          'BACKEND OFFLINE',
          'Start backend on port 3001 or choose Demo Preview.',
          'telegram_connect',
        );
      }
    }
  }

  async handleHardwareAction(action: HardwareAction): Promise<void> {
    if (action.type === 'system_exit') {
      await this.cancelVoiceRecording();
      this.stopPairingPoll();
      return;
    }

    if (action.type === 'audio') {
      this.recorder.pushPcmFrame(action.audioPcm);
      return;
    }

    if (this.state.isProcessingVoice) {
      return;
    }

    if (action.type === 'double_click') {
      await this.handleBack();
      return;
    }

    if (action.type === 'scroll_up' || action.type === 'scroll_down') {
      await this.handleScroll(action.type === 'scroll_up' ? -1 : 1);
      return;
    }

    await this.handleSelect(action.listIndex ?? 0);
  }

  async jumpToScreen(screen: ScreenId): Promise<void> {
    await this.cancelVoiceRecording();
    this.stopPairingPoll();
    if (screen === 'voice_recording') {
      await this.startVoiceRecording('command');
    } else if (screen === 'pairing') {
      await this.startPairingFlow();
    } else if ((screen === 'reply_suggestion' || screen === 'confirmation') && !this.state.activeDraft) {
      await this.prepareDraftForSelectedMessage();
    } else if (screen === 'error' && !this.state.error) {
      this.state.error = {
        title: 'CONNECTION LOST',
        detail: 'Sample error state for simulator verification.',
        recoverableTo: 'overview',
      };
    }
    this.navigate(screen);
    await this.render();
  }

  private async restoreExistingSession(): Promise<void> {
    try {
      const storedToken = await this.bridge.getLocalStorage(SESSION_STORAGE_KEY);
      if (!storedToken) return;
      this.api.setSessionToken(storedToken);
      const status = await this.api.getPairingStatus();
      if (status.paired && status.telegramConnected) {
        this.state.connectionMode = 'telegram';
        await this.syncLiveMessages();
      }
    } catch {
      // Ignore expired/stale stored tokens cleanly.
    }
  }

  private async startPairingFlow(): Promise<boolean> {
    try {
      const initRes = await this.api.initPairing(this.state.deviceLabel);
      this.api.setSessionToken(initRes.sessionToken);
      await this.bridge.setLocalStorage(SESSION_STORAGE_KEY, initRes.sessionToken).catch(() => false);
      this.state.pairingCode = initRes.code;
      this.state.setupUrl = initRes.setupUrl;
      this.startPairingPoll();
      return true;
    } catch (err) {
      this.showError(
        'PAIRING FAILED',
        err instanceof Error ? err.message : 'Unable to start pairing with backend.',
        'telegram_connect',
      );
      return false;
    }
  }

  private startPairingPoll(): void {
    this.stopPairingPoll();
    this.pairingPollTimer = globalThis.setInterval(() => {
      if (this.state.screen !== 'pairing') {
        this.stopPairingPoll();
        return;
      }
      void this.checkPairingCompletion(false);
    }, 3000) as unknown as number;
  }

  private stopPairingPoll(): void {
    if (this.pairingPollTimer !== null) {
      globalThis.clearInterval(this.pairingPollTimer);
      this.pairingPollTimer = null;
    }
  }

  private async checkPairingCompletion(notifyIfPending: boolean): Promise<void> {
    try {
      const status = await this.api.getPairingStatus();
      if (status.paired && status.telegramConnected) {
        this.stopPairingPoll();
        this.state.connectionMode = 'telegram';
        await this.syncLiveMessages();
        this.navigate('overview');
        await this.render();
        return;
      }
      if (notifyIfPending && status.paired && !status.telegramConnected) {
        this.showError(
          'SIGN IN ON PHONE',
          'Browser paired. Complete Telegram login & chat selection in /setup.',
          'pairing',
        );
        await this.render();
      }
    } catch (err) {
      if (notifyIfPending) {
        this.showError(
          'PAIR CHECK FAILED',
          err instanceof Error ? err.message : 'Unable to verify pairing status.',
          'pairing',
        );
        await this.render();
      }
    }
  }

  private async syncLiveMessages(): Promise<void> {
    const res = await this.api.fetchImportantMessages();
    this.state.messages = res.messages;
    this.state.summary = res.summary;
    this.state.selectedMessageIndex = 0;
  }

  private async handleSelect(listIndex: number): Promise<void> {
    switch (this.state.screen) {
      case 'welcome':
        await this.checkBackendHealth(false);
        if (this.state.connectionMode === 'telegram') {
          this.navigate('overview');
        } else {
          this.navigate('telegram_connect');
        }
        break;

      case 'telegram_connect':
        if (listIndex === 0) {
          const started = await this.startPairingFlow();
          if (started) {
            this.navigate('pairing');
          }
        } else if (listIndex === 1) {
          this.state.connectionMode = 'demo';
          this.state.messages = DEMO_MESSAGES;
          this.state.summary = DEMO_CHAT_SUMMARY;
          this.navigate('overview');
        } else {
          await this.checkBackendHealth(true);
        }
        break;

      case 'pairing':
        await this.checkPairingCompletion(true);
        return;

      case 'overview':
        if (listIndex === 0) {
          if (this.state.connectionMode === 'telegram') {
            try {
              await this.syncLiveMessages();
            } catch (err) {
              this.handleApiError(err, 'overview');
              break;
            }
          }
          this.navigate('important_messages');
        } else if (listIndex === 1) {
          if (this.state.connectionMode === 'telegram') {
            try {
              const aiRes = await this.api.summarizeChat();
              this.state.summary = aiRes.summary;
            } catch (err) {
              this.handleApiError(err, 'overview');
              break;
            }
          }
          this.navigate('ai_summary');
        } else if (listIndex === 2) {
          await this.startVoiceRecording('command');
          this.navigate('voice_recording');
        } else {
          this.navigate('telegram_connect');
        }
        break;

      case 'important_messages':
        if (this.state.messages.length > 0) {
          this.state.selectedMessageIndex = Math.min(
            listIndex,
            this.state.messages.length - 1,
          );
          this.navigate('message_detail');
        } else {
          this.navigate('overview');
        }
        break;

      case 'message_detail':
        if (listIndex === 0) {
          await this.prepareDraftForSelectedMessage();
          if (this.state.activeDraft) {
            this.navigate('reply_suggestion');
          }
        } else if (listIndex === 1) {
          if (this.state.connectionMode === 'telegram') {
            try {
              const msg = this.state.messages[this.state.selectedMessageIndex];
              const aiRes = await this.api.summarizeChat(
                msg ? { chatId: msg.chatId, chatTitle: msg.chatTitle } : undefined,
              );
              this.state.summary = aiRes.summary;
            } catch (err) {
              this.handleApiError(err, 'message_detail');
              break;
            }
          }
          this.navigate('ai_summary');
        } else if (listIndex === 2) {
          await this.translateSelectedMessage();
        } else if (listIndex === 3) {
          await this.prepareDraftForSelectedMessage();
          if (this.state.activeDraft) {
            await this.startVoiceRecording('reply_edit');
            this.navigate('voice_recording');
          }
        } else if (this.state.messages.length > 0) {
          this.state.selectedMessageIndex =
            (this.state.selectedMessageIndex + 1) % this.state.messages.length;
        }
        break;

      case 'ai_summary':
        if (listIndex === 0) {
          this.navigate('important_messages');
        } else if (listIndex === 1) {
          await this.startVoiceRecording('command');
          this.navigate('voice_recording');
        } else {
          this.navigate('overview');
        }
        break;

      case 'reply_suggestion':
        if (listIndex === 0) {
          this.navigate('confirmation');
        } else if (listIndex === 1) {
          await this.regenerateDraft();
        } else if (listIndex === 2) {
          await this.startVoiceRecording('reply_edit');
          this.navigate('voice_recording');
        } else {
          this.state.activeDraft = null;
          this.navigate('message_detail');
        }
        break;

      case 'voice_recording':
        await this.finishVoiceRecording();
        break;

      case 'confirmation':
        if (listIndex === 0) {
          const draft = this.state.activeDraft;
          if (!draft) {
            this.navigate('overview');
            break;
          }
          if (this.state.connectionMode === 'telegram') {
            try {
              const msgIdPart = Number(draft.messageId.split(':')[1]);
              await this.api.sendConfirmedMessage({
                chatId: draft.chatId,
                text: draft.draftText,
                replyToMsgId: Number.isInteger(msgIdPart) && msgIdPart > 0 ? msgIdPart : undefined,
                source: draft.source,
              });
              this.state.lastSentSummary = `Sent to ${draft.chatTitle}: "${draft.draftText}"`;
              this.state.activeDraft = null;
              this.navigate('success');
            } catch (err) {
              this.handleApiError(err, 'confirmation');
            }
          } else {
            this.state.lastSentSummary = `[DEMO] Preview only — not sent to Telegram: "${draft.draftText}"`;
            this.state.activeDraft = null;
            this.navigate('success');
          }
        } else {
          this.navigate('reply_suggestion');
        }
        break;

      case 'success':
        this.navigate('overview');
        break;

      case 'error':
        if (listIndex === 0) {
          await this.checkBackendHealth(false);
          const target = this.state.error?.recoverableTo ?? 'overview';
          this.state.error = null;
          this.navigate(target);
        } else if (listIndex === 1) {
          this.state.error = null;
          const started = await this.startPairingFlow();
          if (started) {
            this.navigate('pairing');
          }
        } else {
          this.state.error = null;
          this.navigate('overview');
        }
        break;
    }

    await this.render();
  }

  private async handleBack(): Promise<void> {
    await this.cancelVoiceRecording();
    this.stopPairingPoll();

    if (this.state.screen === 'welcome' || this.state.screen === 'overview') {
      await this.display.exitApp();
      return;
    }

    if (this.state.screen === 'success') {
      this.navigate('important_messages');
      await this.render();
      return;
    }

    const previous = this.state.history.pop();
    this.state.screen = previous ?? 'overview';
    await this.render();
  }

  private async handleScroll(delta: -1 | 1): Promise<void> {
    if (this.state.screen === 'message_detail' && this.state.messages.length > 1) {
      const len = this.state.messages.length;
      this.state.selectedMessageIndex =
        (this.state.selectedMessageIndex + delta + len) % len;
      await this.render();
    }
  }

  private handleApiError(err: unknown, fallbackScreen: ScreenId): void {
    if (err instanceof ApiError) {
      if (err.code === 'REAUTH_REQUIRED' || err.code === 'UNAUTHORIZED') {
        this.state.connectionMode = 'disconnected';
        this.showError('REAUTH REQUIRED', err.message, 'telegram_connect');
        return;
      }
      this.showError(err.code, err.message, fallbackScreen);
      return;
    }
    this.showError(
      'NETWORK ERROR',
      err instanceof Error ? err.message : 'Unexpected backend error.',
      fallbackScreen,
    );
  }

  private navigate(next: ScreenId): void {
    if (this.state.screen !== next) {
      this.state.history.push(this.state.screen);
      if (this.state.history.length > 16) {
        this.state.history.shift();
      }
      this.state.screen = next;
    }
  }

  private showError(title: string, detail: string, recoverableTo: ScreenId): void {
    this.state.error = { title, detail, recoverableTo };
    this.navigate('error');
  }

  private async prepareDraftForSelectedMessage(): Promise<void> {
    const msg = this.state.messages[this.state.selectedMessageIndex] ?? this.state.messages[0];
    if (!msg) return;

    if (this.state.connectionMode === 'telegram') {
      try {
        const res = await this.api.suggestReply({
          chatId: msg.chatId,
          chatTitle: msg.chatTitle,
          sender: msg.sender,
          incomingText: msg.text,
          variationIndex: 0,
        });
        this.state.activeDraft = {
          messageId: msg.id,
          chatId: msg.chatId,
          chatTitle: msg.chatTitle,
          sender: msg.sender,
          incomingPreview: msg.text,
          draftText: res.replyText,
          source: 'ai',
          variantIndex: 0,
        };
        return;
      } catch (err) {
        this.handleApiError(err, 'message_detail');
        return;
      }
    }

    this.state.activeDraft = {
      messageId: msg.id,
      chatId: msg.chatId,
      chatTitle: msg.chatTitle,
      sender: msg.sender,
      incomingPreview: msg.text,
      draftText: DEMO_REPLY_VARIANTS[0],
      source: 'ai',
      variantIndex: 0,
    };
  }

  private async regenerateDraft(): Promise<void> {
    if (!this.state.activeDraft) {
      await this.prepareDraftForSelectedMessage();
      return;
    }
    const nextIdx = this.state.activeDraft.variantIndex + 1;

    if (this.state.connectionMode === 'telegram') {
      try {
        const res = await this.api.suggestReply({
          chatId: this.state.activeDraft.chatId,
          chatTitle: this.state.activeDraft.chatTitle,
          sender: this.state.activeDraft.sender,
          incomingText: this.state.activeDraft.incomingPreview,
          variationIndex: nextIdx,
        });
        this.state.activeDraft = {
          ...this.state.activeDraft,
          source: 'ai',
          variantIndex: nextIdx,
          draftText: res.replyText,
        };
        return;
      } catch (err) {
        this.handleApiError(err, 'reply_suggestion');
        return;
      }
    }

    const demoIdx = nextIdx % DEMO_REPLY_VARIANTS.length;
    this.state.activeDraft = {
      ...this.state.activeDraft,
      source: 'ai',
      variantIndex: demoIdx,
      draftText: DEMO_REPLY_VARIANTS[demoIdx],
    };
  }

  private async translateSelectedMessage(): Promise<void> {
    const msg = this.state.messages[this.state.selectedMessageIndex];
    if (!msg) return;

    if (this.state.connectionMode === 'telegram') {
      try {
        const res = await this.api.translateMessage({
          text: msg.text,
          targetLanguage: 'English',
        });
        this.state.summary = {
          chatTitle: `TRANSLATED (${res.detectedLanguage.toUpperCase()})`,
          unreadCount: 1,
          lines: res.translatedLines,
          actionCount: msg.needsReply ? 1 : 0,
        };
        this.navigate('ai_summary');
      } catch (err) {
        this.handleApiError(err, 'message_detail');
      }
      return;
    }

    this.state.summary = {
      chatTitle: 'TRANSLATION [DEMO]',
      unreadCount: 1,
      lines: [msg.text.slice(0, 38), 'Demo mode: live AI needs API key.'],
      actionCount: msg.needsReply ? 1 : 0,
    };
    this.navigate('ai_summary');
  }

  private async startVoiceRecording(mode: VoiceMode): Promise<void> {
    this.stopRecordingTimer();
    this.state.voiceMode = mode;
    this.state.isRecording = true;
    this.state.isProcessingVoice = false;
    this.state.recordingSeconds = 0;

    await this.recorder.start();

    this.recordingTimer = globalThis.setInterval(() => {
      if (this.state.screen !== 'voice_recording' || this.state.isProcessingVoice) {
        this.stopRecordingTimer();
        return;
      }
      this.state.recordingSeconds += 1;
      void this.render();
    }, 1000) as unknown as number;
  }

  private async cancelVoiceRecording(): Promise<void> {
    this.stopRecordingTimer();
    this.state.isProcessingVoice = false;
    if (this.recorder.isActive()) {
      await this.recorder.cancel();
    }
  }

  private async finishVoiceRecording(): Promise<void> {
    this.stopRecordingTimer();
    const pcm = await this.recorder.stop();

    if (this.state.connectionMode !== 'telegram') {
      // Demo preview fallback when Telegram/OpenAI aren't paired.
      if (!this.state.activeDraft) {
        await this.prepareDraftForSelectedMessage();
      }
      if (this.state.activeDraft) {
        this.state.activeDraft = {
          ...this.state.activeDraft,
          source: 'voice',
          draftText: '[DEMO VOICE] Yes, I will be there at 10:30.',
        };
      }
      this.navigate('reply_suggestion');
      return;
    }

    if (pcm.byteLength < 4000) {
      this.showError(
        'MIC AUDIO EMPTY',
        'No audio captured. Ensure mic permission & --aid in simulator.',
        'overview',
      );
      return;
    }

    this.state.isProcessingVoice = true;
    await this.render();

    try {
      const selectedMsg = this.state.messages[this.state.selectedMessageIndex];
      const activeMsg = this.state.activeDraft
        ? {
            id: this.state.activeDraft.messageId,
            chatId: this.state.activeDraft.chatId,
            chatTitle: this.state.activeDraft.chatTitle,
            sender: this.state.activeDraft.sender,
            text: this.state.activeDraft.incomingPreview,
          }
        : selectedMsg
          ? {
              id: selectedMsg.id,
              chatId: selectedMsg.chatId,
              chatTitle: selectedMsg.chatTitle,
              sender: selectedMsg.sender,
              text: selectedMsg.text,
            }
          : undefined;

      const res = await this.api.sendVoiceCommand({
        pcmBase64: uint8ToBase64(pcm),
        mode: this.state.voiceMode,
        activeMessage: activeMsg,
      });

      this.state.voiceTranscript = res.transcript;

      switch (res.action) {
        case 'summarize_chat':
          if (res.summary) this.state.summary = res.summary;
          this.navigate('ai_summary');
          break;

        case 'important_messages':
          await this.syncLiveMessages();
          this.navigate('important_messages');
          break;

        case 'translate_message':
          if (res.translation) {
            this.state.summary = {
              chatTitle: `TRANSLATED (${res.translation.detectedLanguage.toUpperCase()})`,
              unreadCount: 1,
              lines: res.translation.translatedLines,
              actionCount: 0,
            };
          }
          this.navigate('ai_summary');
          break;

        case 'ask_context':
          if (res.answer) {
            this.state.summary = {
              chatTitle: res.answer.citedChat
                ? `AI · ${res.answer.citedChat.toUpperCase()}`
                : 'AI ANSWER',
              unreadCount: 1,
              lines: res.answer.answerLines,
              actionCount: 0,
            };
          }
          this.navigate('ai_summary');
          break;

        case 'draft_reply':
          if (res.targetMessage && res.draftText) {
            this.state.activeDraft = {
              messageId: res.targetMessage.id,
              chatId: res.targetMessage.chatId,
              chatTitle: res.targetMessage.chatTitle,
              sender: res.targetMessage.sender,
              incomingPreview: res.targetMessage.text,
              draftText: res.draftText,
              source: 'voice',
              variantIndex: 0,
            };
          }
          this.navigate('reply_suggestion');
          break;
      }
    } catch (err) {
      this.handleApiError(err, 'overview');
    } finally {
      this.state.isProcessingVoice = false;
    }
  }

  private stopRecordingTimer(): void {
    if (this.recordingTimer !== null) {
      globalThis.clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
    this.state.isRecording = false;
  }

  private async render(): Promise<void> {
    const layout = buildG2Layout(this.state);
    await this.display.render(layout);
    for (const listener of this.listeners) {
      listener(this.state, layout);
    }
  }
}
