-- Telegram AI Copilot for Even Realities G2
-- PostgreSQL Schema (Phase 2 + Phase 4 Sessions)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pairing_codes (
  code VARCHAR(12) PRIMARY KEY,
  device_label TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_token_hash TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paired', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pairing_codes_expires_at ON pairing_codes(expires_at);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(16) NOT NULL DEFAULT 'device' CHECK (kind IN ('device', 'setup')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS telegram_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_masked TEXT NOT NULL,
  encrypted_session TEXT NOT NULL,
  session_iv TEXT NOT NULL,
  session_tag TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'reauth_required')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS monitored_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id TEXT NOT NULL,
  title TEXT NOT NULL,
  chat_type VARCHAR(24) NOT NULL DEFAULT 'group',
  priority_weight INTEGER NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, telegram_chat_id)
);

CREATE TABLE IF NOT EXISTS message_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id TEXT NOT NULL,
  telegram_msg_id BIGINT NOT NULL,
  sender_name TEXT NOT NULL,
  body_preview TEXT NOT NULL,
  importance_score INTEGER NOT NULL DEFAULT 0,
  ai_summary TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, telegram_chat_id, telegram_msg_id)
);

CREATE INDEX IF NOT EXISTS idx_message_cache_user_received
  ON message_cache(user_id, received_at DESC);

CREATE TABLE IF NOT EXISTS reply_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id TEXT NOT NULL,
  reply_to_msg_id BIGINT,
  draft_text TEXT NOT NULL,
  source VARCHAR(16) NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'voice')),
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'rejected', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
