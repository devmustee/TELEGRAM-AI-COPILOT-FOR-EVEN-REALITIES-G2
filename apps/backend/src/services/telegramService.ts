import { Api, TelegramClient, sessions } from 'telegram';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { decryptSecret, encryptSecret, maskPhone } from '../security/crypto.js';
import {
  buildDeterministicDigest,
  scoreMessage,
  type ScoredMessage,
} from './prioritizer.js';

const { StringSession } = sessions;

export class TelegramServiceError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

interface PendingLogin {
  client: TelegramClient;
  phoneNumber: string;
  phoneCodeHash: string;
  createdAt: number;
}

export interface TelegramDialogSummary {
  chatId: string;
  title: string;
  chatType: 'dm' | 'group' | 'channel';
  unreadCount: number;
}

const pendingLogins = new Map<string, PendingLogin>();
const activeClients = new Map<string, TelegramClient>();
const syncCache = new Map<
  string,
  {
    expiresAt: number;
    data: {
      messages: ScoredMessage[];
      summary: {
        chatTitle: string;
        unreadCount: number;
        lines: string[];
        actionCount: number;
      };
    };
  }
>();
const SYNC_CACHE_TTL_MS = 10_000;

function getTelegramCredentials(): { apiId: number; apiHash: string } {
  const apiId = Number(env.TELEGRAM_API_ID);
  const apiHash = env.TELEGRAM_API_HASH.trim();
  if (!Number.isInteger(apiId) || apiId <= 0 || !apiHash) {
    throw new TelegramServiceError(
      'TELEGRAM_NOT_CONFIGURED',
      'TELEGRAM_API_ID and TELEGRAM_API_HASH must be configured on the backend.',
      503,
    );
  }
  return { apiId, apiHash };
}

function getRpcErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { errorMessage?: string; message?: string };
    return e.errorMessage || e.message || String(err);
  }
  return String(err);
}

function mapTelegramError(err: unknown): TelegramServiceError {
  if (err instanceof TelegramServiceError) return err;
  const msg = getRpcErrorMessage(err);

  if (msg.includes('SESSION_PASSWORD_NEEDED')) {
    return new TelegramServiceError('PASSWORD_REQUIRED', '2FA password required.', 401);
  }
  if (msg.includes('PHONE_CODE_INVALID')) {
    return new TelegramServiceError('INVALID_CODE', 'Invalid Telegram verification code.', 400);
  }
  if (msg.includes('PHONE_CODE_EXPIRED')) {
    return new TelegramServiceError('CODE_EXPIRED', 'Verification code expired. Request a new code.', 400);
  }
  if (msg.includes('PASSWORD_HASH_INVALID')) {
    return new TelegramServiceError('INVALID_PASSWORD', 'Incorrect Telegram 2FA password.', 401);
  }
  if (msg.includes('FLOOD_WAIT')) {
    return new TelegramServiceError('RATE_LIMITED', `Telegram rate limit: ${msg}`, 429);
  }
  if (msg.includes('AUTH_KEY_UNREGISTERED') || msg.includes('USER_DEACTIVATED')) {
    return new TelegramServiceError('REAUTH_REQUIRED', 'Telegram session expired. Please reconnect in /setup.', 401);
  }

  return new TelegramServiceError('TELEGRAM_ERROR', msg, 502);
}

async function createClient(sessionStr = ''): Promise<TelegramClient> {
  const { apiId, apiHash } = getTelegramCredentials();
  const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
    connectionRetries: 3,
  });
  await client.connect();
  return client;
}

async function getClientForUser(userId: string): Promise<TelegramClient> {
  const cached = activeClients.get(userId);
  if (cached?.connected) {
    return cached;
  }

  const res = await pool.query<{
    encrypted_session: string;
    session_iv: string;
    session_tag: string;
    status: string;
  }>(
    `SELECT encrypted_session, session_iv, session_tag, status
       FROM telegram_accounts
      WHERE user_id = $1
      LIMIT 1`,
    [userId],
  );

  if (res.rowCount === 0 || res.rows[0].status === 'disconnected') {
    throw new TelegramServiceError(
      'TELEGRAM_DISCONNECTED',
      'No active Telegram account connected. Open /setup to sign in.',
      401,
    );
  }

  const row = res.rows[0];
  if (row.status === 'reauth_required') {
    throw new TelegramServiceError(
      'REAUTH_REQUIRED',
      'Telegram session requires re-authentication in /setup.',
      401,
    );
  }

  const sessionString = decryptSecret(
    row.encrypted_session,
    row.session_iv,
    row.session_tag,
  );

  try {
    const client = await createClient(sessionString);
    const authorized = await client.checkAuthorization();
    if (!authorized) {
      await pool.query(
        `UPDATE telegram_accounts SET status = 'reauth_required', updated_at = NOW() WHERE user_id = $1`,
        [userId],
      );
      await client.disconnect();
      throw new TelegramServiceError(
        'REAUTH_REQUIRED',
        'Telegram authorization expired. Reconnect via /setup.',
        401,
      );
    }
    activeClients.set(userId, client);
    return client;
  } catch (err) {
    const mapped = mapTelegramError(err);
    if (mapped.code === 'REAUTH_REQUIRED') {
      await pool.query(
        `UPDATE telegram_accounts SET status = 'reauth_required', updated_at = NOW() WHERE user_id = $1`,
        [userId],
      );
    }
    throw mapped;
  }
}

async function resolvePeerEntity(client: TelegramClient, chatId: string) {
  try {
    return await client.getInputEntity(chatId);
  } catch {
    // Populate entity cache on fresh restarts before retrying.
    await client.getDialogs({ limit: 80 });
    return await client.getInputEntity(chatId);
  }
}

export async function startPhoneLogin(
  userId: string,
  phoneNumber: string,
): Promise<{ step: 'code_sent' }> {
  const credentials = getTelegramCredentials();
  const prev = pendingLogins.get(userId);
  if (prev) {
    await prev.client.disconnect().catch(() => undefined);
    pendingLogins.delete(userId);
  }

  try {
    const client = await createClient('');
    const { phoneCodeHash } = await client.sendCode(credentials, phoneNumber);
    pendingLogins.set(userId, {
      client,
      phoneNumber,
      phoneCodeHash,
      createdAt: Date.now(),
    });
    return { step: 'code_sent' };
  } catch (err) {
    throw mapTelegramError(err);
  }
}

export async function verifyLoginCode(
  userId: string,
  code: string,
  password?: string,
): Promise<
  | { step: 'password_required' }
  | { step: 'connected'; phoneMasked: string }
> {
  const credentials = getTelegramCredentials();
  const pending = pendingLogins.get(userId);
  if (!pending || Date.now() - pending.createdAt > 10 * 60_000) {
    pendingLogins.delete(userId);
    throw new TelegramServiceError(
      'LOGIN_SESSION_EXPIRED',
      'Login flow expired. Request a new code.',
      400,
    );
  }

  const { client, phoneNumber, phoneCodeHash } = pending;

  try {
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode: code,
      }),
    );
  } catch (err) {
    const msg = getRpcErrorMessage(err);
    if (msg.includes('SESSION_PASSWORD_NEEDED')) {
      if (!password) {
        return { step: 'password_required' };
      }
      try {
        await client.signInWithPassword(credentials, {
          password: async () => password,
          onError: (pwErr) => {
            throw pwErr;
          },
        });
      } catch (pwErr) {
        throw mapTelegramError(pwErr);
      }
    } else {
      throw mapTelegramError(err);
    }
  }

  const sessionString = String(client.session.save() ?? '');
  if (!sessionString) {
    throw new TelegramServiceError('SESSION_SAVE_FAILED', 'Failed to obtain Telegram session.', 500);
  }

  const encrypted = encryptSecret(sessionString);
  const phoneMasked = maskPhone(phoneNumber);

  await pool.query(
    `INSERT INTO telegram_accounts (user_id, phone_masked, encrypted_session, session_iv, session_tag, status)
     VALUES ($1, $2, $3, $4, $5, 'connected')
     ON CONFLICT (user_id) DO UPDATE SET
       phone_masked = EXCLUDED.phone_masked,
       encrypted_session = EXCLUDED.encrypted_session,
       session_iv = EXCLUDED.session_iv,
       session_tag = EXCLUDED.session_tag,
       status = 'connected',
       updated_at = NOW()`,
    [userId, phoneMasked, encrypted.ciphertext, encrypted.iv, encrypted.tag],
  );

  pendingLogins.delete(userId);
  activeClients.set(userId, client);

  return { step: 'connected', phoneMasked };
}

export async function disconnectTelegramUser(userId: string): Promise<void> {
  const pending = pendingLogins.get(userId);
  if (pending) {
    await pending.client.disconnect().catch(() => undefined);
    pendingLogins.delete(userId);
  }
  const active = activeClients.get(userId);
  if (active) {
    await active.disconnect().catch(() => undefined);
    activeClients.delete(userId);
  }
  await pool.query(
    `UPDATE telegram_accounts SET status = 'disconnected', updated_at = NOW() WHERE user_id = $1`,
    [userId],
  );
}

export async function listUserDialogs(userId: string): Promise<TelegramDialogSummary[]> {
  const client = await getClientForUser(userId);
  try {
    const dialogs = await client.getDialogs({ limit: 40 });
    return dialogs
      .filter((d) => d.id !== undefined)
      .map((d) => ({
        chatId: d.id!.toString(),
        title: d.title || d.name || d.id!.toString(),
        chatType: d.isChannel && !d.isGroup ? 'channel' : d.isGroup ? 'group' : 'dm',
        unreadCount: d.unreadCount ?? 0,
      }));
  } catch (err) {
    throw mapTelegramError(err);
  }
}

export async function syncImportantMessages(
  userId: string,
  forceRefresh = false,
): Promise<{
  messages: ScoredMessage[];
  summary: {
    chatTitle: string;
    unreadCount: number;
    lines: string[];
    actionCount: number;
  };
}> {
  if (!forceRefresh) {
    const cached = syncCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  const chatsRes = await pool.query<{
    telegram_chat_id: string;
    title: string;
    priority_weight: number;
  }>(
    `SELECT telegram_chat_id, title, priority_weight
       FROM monitored_chats
      WHERE user_id = $1 AND enabled = TRUE
      ORDER BY priority_weight DESC, created_at ASC
      LIMIT 10`,
    [userId],
  );

  if (chatsRes.rowCount === 0) {
    return {
      messages: [],
      summary: {
        chatTitle: 'NO CHATS SELECTED',
        unreadCount: 0,
        lines: [
          'Open /setup to select chats',
          'to monitor on your G2.',
        ],
        actionCount: 0,
      },
    };
  }

  const client = await getClientForUser(userId);
  const scored: ScoredMessage[] = [];
  const cacheRows: Array<{
    chatId: string;
    msgId: number;
    senderName: string;
    preview: string;
    score: number;
    receivedAt: Date;
  }> = [];

  try {
    for (const chat of chatsRes.rows) {
      const entity = await resolvePeerEntity(client, chat.telegram_chat_id);
      const msgs = await client.getMessages(entity, { limit: 12 });

      for (const msg of msgs) {
        const text = (msg.message || '').trim();
        if (!text) continue;

        let senderName = chat.title;
        const senderObj = msg.sender as
          | { firstName?: string; lastName?: string; username?: string; title?: string }
          | undefined;
        if (senderObj) {
          const full = [senderObj.firstName, senderObj.lastName].filter(Boolean).join(' ').trim();
          senderName = full || senderObj.username || senderObj.title || chat.title;
        }
        if (msg.out) senderName = 'You';

        const receivedAt = new Date((msg.date ?? Math.floor(Date.now() / 1000)) * 1000);
        const item = scoreMessage({
          id: `${chat.telegram_chat_id}:${msg.id}`,
          chatId: chat.telegram_chat_id,
          chatTitle: chat.title,
          sender: senderName,
          text,
          receivedAt,
          priorityWeight: chat.priority_weight,
          isOutgoing: Boolean(msg.out),
        });

        if (!item.isOutgoing) {
          scored.push(item);
        }

        cacheRows.push({
          chatId: chat.telegram_chat_id,
          msgId: msg.id,
          senderName,
          preview: text.slice(0, 500),
          score: item.importanceScore,
          receivedAt,
        });
      }
    }
  } catch (err) {
    throw mapTelegramError(err);
  }

  if (cacheRows.length > 0) {
    await pool.query(
      `INSERT INTO message_cache (
         user_id, telegram_chat_id, telegram_msg_id, sender_name, body_preview, importance_score, received_at
       )
       SELECT $1, chat_id, msg_id, sender_name, preview, score, received_at
         FROM UNNEST(
           $2::text[],
           $3::bigint[],
           $4::text[],
           $5::text[],
           $6::int[],
           $7::timestamptz[]
         ) AS t(chat_id, msg_id, sender_name, preview, score, received_at)
       ON CONFLICT (user_id, telegram_chat_id, telegram_msg_id) DO UPDATE SET
         sender_name = EXCLUDED.sender_name,
         body_preview = EXCLUDED.body_preview,
         importance_score = EXCLUDED.importance_score`,
      [
        userId,
        cacheRows.map((r) => r.chatId),
        cacheRows.map((r) => r.msgId),
        cacheRows.map((r) => r.senderName),
        cacheRows.map((r) => r.preview),
        cacheRows.map((r) => r.score),
        cacheRows.map((r) => r.receivedAt),
      ],
    );
  }

  scored.sort(
    (a, b) =>
      b.importanceScore - a.importanceScore ||
      b.receivedAt.getTime() - a.receivedAt.getTime(),
  );

  const topMessages = scored.slice(0, 15);
  const result = {
    messages: topMessages,
    summary: buildDeterministicDigest(topMessages),
  };
  syncCache.set(userId, {
    expiresAt: Date.now() + SYNC_CACHE_TTL_MS,
    data: result,
  });
  return result;
}

export async function sendConfirmedTelegramMessage(params: {
  userId: string;
  chatId: string;
  text: string;
  replyToMsgId?: number;
  source: 'ai' | 'voice';
}): Promise<{ draftId: string; sentMsgId: number }> {
  const { userId, chatId, text, replyToMsgId, source } = params;

  const allowedRes = await pool.query<{ title: string }>(
    `SELECT title
       FROM monitored_chats
      WHERE user_id = $1 AND telegram_chat_id = $2 AND enabled = TRUE
      LIMIT 1`,
    [userId, chatId],
  );

  if (allowedRes.rowCount === 0) {
    throw new TelegramServiceError(
      'CHAT_NOT_AUTHORIZED',
      'Cannot send to a chat that is not enabled in your monitored allowlist.',
      403,
    );
  }

  const draftRes = await pool.query<{ id: string }>(
    `INSERT INTO reply_drafts (user_id, telegram_chat_id, reply_to_msg_id, draft_text, source, status)
     VALUES ($1, $2, $3, $4, $5, 'approved')
     RETURNING id`,
    [userId, chatId, replyToMsgId ?? null, text, source],
  );
  const draftId = draftRes.rows[0].id;

  try {
    const client = await getClientForUser(userId);
    const entity = await resolvePeerEntity(client, chatId);
    const sent = await client.sendMessage(entity, {
      message: text,
      ...(replyToMsgId ? { replyTo: replyToMsgId } : {}),
    });

    await pool.query(
      `UPDATE reply_drafts SET status = 'sent', sent_at = NOW() WHERE id = $1`,
      [draftId],
    );
    return { draftId, sentMsgId: sent.id };
  } catch (err) {
    await pool.query(
      `UPDATE reply_drafts SET status = 'failed' WHERE id = $1`,
      [draftId],
    );
    throw mapTelegramError(err);
  }
}
