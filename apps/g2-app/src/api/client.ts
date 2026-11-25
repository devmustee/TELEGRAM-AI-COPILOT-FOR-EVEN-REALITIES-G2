import type { ChatSummary, ImportantMessage } from '../types/copilot';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface PairInitResponse {
  ok: true;
  code: string;
  sessionToken: string;
  setupUrl: string;
  expiresAt: string;
}

export interface PairStatusResponse {
  ok: true;
  paired: boolean;
  status: string;
  telegramConnected: boolean;
  telegramStatus?: string;
  phoneMasked?: string | null;
  monitoredChatsCount: number;
}

export interface ImportantMessagesResponse {
  ok: true;
  messages: ImportantMessage[];
  summary: ChatSummary;
}

export class CopilotApiClient {
  private readonly baseUrl: string;
  private sessionToken = '';

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setSessionToken(token: string): void {
    this.sessionToken = token;
  }

  getSessionToken(): string {
    return this.sessionToken;
  }

  async checkHealth(): Promise<{ ok: boolean; db: string }> {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new ApiError('HTTP_ERROR', `Server returned ${res.status}`, res.status);
      }
      return (await res.json()) as { ok: boolean; db: string };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError('TIMEOUT', 'Health check timed out.', 504);
      }
      throw new ApiError('NETWORK_ERROR', 'Backend unreachable.', 0);
    } finally {
      globalThis.clearTimeout(timer);
    }
  }

  async initPairing(deviceLabel = 'Even G2'): Promise<PairInitResponse> {
    return this.request<PairInitResponse>('/api/pair/init', {
      method: 'POST',
      body: JSON.stringify({ deviceLabel }),
    });
  }

  async getPairingStatus(): Promise<PairStatusResponse> {
    return this.request<PairStatusResponse>('/api/pair/status');
  }

  async fetchImportantMessages(): Promise<ImportantMessagesResponse> {
    return this.request<ImportantMessagesResponse>('/api/messages/important');
  }

  async sendConfirmedMessage(params: {
    chatId: string;
    text: string;
    replyToMsgId?: number;
    source: 'ai' | 'voice';
  }): Promise<{ ok: true; draftId: string; sentMsgId: number }> {
    return this.request('/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        ...params,
        confirmed: true,
      }),
    });
  }

  async summarizeChat(params?: {
    chatId?: string;
    chatTitle?: string;
  }): Promise<{ ok: true; summary: ChatSummary }> {
    return this.request('/api/ai/summarize', {
      method: 'POST',
      body: JSON.stringify(params ?? {}),
    });
  }

  async suggestReply(params: {
    chatId: string;
    chatTitle: string;
    sender: string;
    incomingText: string;
    variationIndex?: number;
    instruction?: string;
  }): Promise<{ ok: true; replyText: string; tone: string }> {
    return this.request('/api/ai/reply', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async askContext(params: {
    question: string;
    chatId?: string;
  }): Promise<{ ok: true; answerLines: string[]; citedSender?: string; citedChat?: string }> {
    return this.request('/api/ai/ask', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async translateMessage(params: {
    text: string;
    targetLanguage?: string;
  }): Promise<{
    ok: true;
    translatedLines: string[];
    detectedLanguage: string;
    targetLanguage: string;
  }> {
    return this.request('/api/ai/translate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async detectIntent(params: {
    transcript: string;
    hasActiveMessage: boolean;
  }): Promise<{
    ok: true;
    intent: 'summarize_chat' | 'important_messages' | 'draft_reply' | 'translate_message' | 'ask_context';
    chatQuery?: string;
    replyInstruction?: string;
    targetLanguage?: string;
    question?: string;
  }> {
    return this.request('/api/ai/intent', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async sendVoiceCommand(params: {
    pcmBase64?: string;
    transcript?: string;
    mode: 'command' | 'reply_edit';
    activeMessage?: {
      id: string;
      chatId: string;
      chatTitle: string;
      sender: string;
      text: string;
    };
  }): Promise<{
    ok: true;
    transcript: string;
    action: 'summarize_chat' | 'important_messages' | 'translate_message' | 'draft_reply' | 'ask_context';
    summary?: ChatSummary;
    draftText?: string;
    targetMessage?: {
      id: string;
      chatId: string;
      chatTitle: string;
      sender: string;
      text: string;
    };
    translation?: {
      translatedLines: string[];
      detectedLanguage: string;
      targetLanguage: string;
    };
    answer?: {
      answerLines: string[];
      citedSender?: string;
      citedChat?: string;
    };
  }> {
    return this.request('/api/voice/command', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    timeoutMs = 15_000,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };
    if (this.sessionToken) {
      headers.Authorization = `Bearer ${this.sessionToken}`;
    }

    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        throw new ApiError(
          data.error || 'REQUEST_FAILED',
          data.message || `HTTP ${res.status}`,
          res.status,
        );
      }

      return data as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError('TIMEOUT', 'Request timed out. Check network connection.', 504);
      }
      throw new ApiError(
        'NETWORK_ERROR',
        err instanceof Error ? err.message : 'Network connection interrupted.',
        0,
      );
    } finally {
      globalThis.clearTimeout(timer);
    }
  }
}
