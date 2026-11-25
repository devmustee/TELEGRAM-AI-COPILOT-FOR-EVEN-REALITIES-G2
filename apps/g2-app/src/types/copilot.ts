export type ScreenId =
  | 'welcome'
  | 'telegram_connect'
  | 'pairing'
  | 'overview'
  | 'important_messages'
  | 'message_detail'
  | 'ai_summary'
  | 'reply_suggestion'
  | 'voice_recording'
  | 'confirmation'
  | 'success'
  | 'error';

export type ConnectionMode = 'disconnected' | 'demo' | 'telegram';
export type VoiceMode = 'command' | 'reply_edit';

export interface ImportantMessage {
  id: string;
  chatId: string;
  chatTitle: string;
  sender: string;
  timestampLabel: string;
  text: string;
  urgency: 'urgent' | 'action' | 'info';
  needsReply: boolean;
}

export interface ChatSummary {
  chatTitle: string;
  unreadCount: number;
  lines: string[];
  actionCount: number;
}

export interface ReplyDraft {
  messageId: string;
  chatId: string;
  chatTitle: string;
  sender: string;
  incomingPreview: string;
  draftText: string;
  source: 'ai' | 'voice';
  variantIndex: number;
}

export interface CopilotErrorState {
  title: string;
  detail: string;
  recoverableTo: ScreenId;
}

export interface CopilotState {
  screen: ScreenId;
  history: ScreenId[];
  connectionMode: ConnectionMode;
  backendHealthy: boolean;
  backendStatusLabel: string;
  pairingCode: string;
  setupUrl: string;
  deviceLabel: string;
  summary: ChatSummary;
  messages: ImportantMessage[];
  selectedMessageIndex: number;
  activeDraft: ReplyDraft | null;
  voiceMode: VoiceMode;
  voiceTranscript: string;
  isRecording: boolean;
  isProcessingVoice: boolean;
  recordingSeconds: number;
  lastSentSummary: string;
  error: CopilotErrorState | null;
}
