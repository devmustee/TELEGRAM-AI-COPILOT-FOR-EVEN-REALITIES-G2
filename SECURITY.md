# Security & Privacy Model: Telegram AI Copilot

Smart glasses present unique security and privacy challenges. Because the display is positioned directly in front of the user's eye and interacts with private messaging channels, **Telegram AI Copilot** implements defense-in-depth architecture across all layers.

---

## 1. Threat Model & Safeguards

| Threat Vector | Risk Scenario | Mitigation in Telegram AI Copilot |
| :--- | :--- | :--- |
| **Accidental Dispatch** | User's hand brushes touchpad; accidental message sent to Telegram group. | **Strict Confirmation Gate:** Outgoing messages cannot auto-send under any circumstances. A dedicated Confirmation screen requires an explicit, intentional second tap or R1 ring click. |
| **Wearable Credential Exposure** | Malicious script or physical extraction from the glasses device. | **Zero-Credential WebView:** No Telegram API credentials, phone numbers, OTP codes, or MTProto session strings ever enter the G2 WebView. The glasses store only an opaque bearer token. |
| **Unauthorized Chat Snooping** | Copilot accesses confidential or non-work Telegram channels without user consent. | **Explicit Chat Allowlist:** By default, Copilot monitors zero chats. The user must explicitly toggle which chats are monitored in the `/setup` companion portal. |
| **Eavesdropping / Audio Snooping** | Microphone continually records private conversations. | **Strictly Ephemeral Audio:** The G2 microphone is only activated (`bridge.audioControl(true)`) when the user enters Voice mode. Audio is held in memory as PCM chunks, transcoded in RAM, and immediately discarded after STT transcription. No audio files are ever written to disk. |
| **Session Hijacking / Database Theft** | Database backup leaked or compromised. | **AES-256-GCM Encryption:** All Telegram session strings are encrypted at rest with AES-256-GCM using an authenticated initialization vector (IV) and authentication tag. Bearer tokens are stored as SHA-256 hashes. |
| **Pairing Interception** | Attacker guesses pairing code and links their Telegram account to a stranger's glasses. | **Ephemeral Rate-Limited Pairing:** 6-character pairing codes expire in 10 minutes, are invalidated immediately upon first claim, and are rate-limited against brute force attempts. |

---

## 2. Zero-Credential Architecture

Smart glasses WebViews run in constrained embedded environments where full secret storage (e.g., OS Keychains) may not be exposed to the SDK runtime.

To address this:
1. **The glasses know only who they are:** The G2 app receives an opaque, random 64-character bearer token upon initial pairing.
2. **The backend mediates all MTProto interactions:** All GramJS client instances run in the backend Node.js runtime inside private network boundaries.
3. **Frontend tokens are hashed:** Tokens in PostgreSQL are stored exclusively as `sha256` digests, mirroring modern web security best practices.

```
┌─────────────────────────────────┐
│        G2 Smart Glasses         │
│  Stores ONLY:                   │
│  - copilot_session_token        │
│  (64-char random hex)           │
│  ZERO API keys / ZERO passwords │
└────────────────┬────────────────┘
                 │
                 ▼ Bearer Authorization
┌─────────────────────────────────┐
│         Backend Server          │
│  Verifies SHA-256(token)        │
│  Decrypts session via           │
│  AES-256-GCM master key         │
└─────────────────────────────────┘
```

---

## 3. Cryptographic Implementation Details

### 3.1 AES-256-GCM Symmetric Encryption
- **Module:** `apps/backend/src/security/crypto.ts`
- **Algorithm:** `aes-256-gcm`
- **Key Derivation:** PBKDF2 with 100,000 iterations and a dedicated application salt.
- **Payload Format:** `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
- Every encryption operation generates a cryptographically secure 12-byte initialization vector (`crypto.randomBytes(12)`). Decryption strictly verifies the GCM authentication tag before returning plaintext.

### 3.2 Ephemeral Pairing Codes
- Generated using `crypto.randomBytes(3)`, formatted as `G2-XXXX` (uppercase alphanumeric).
- Stored with `created_at` timestamp; hard expiration after **10 minutes**.
- Single-use: transition from `pending` to `claimed` atomically in PostgreSQL (`UPDATE pairing_codes SET status = 'claimed' WHERE status = 'pending'`).

---

## 4. Confirmed-Only Send Guardrail

To guarantee user trust, the backend and frontend enforce a hard barrier against automated or speculative message sending:

```typescript
// apps/backend/src/routes/messages.ts
if (!body.confirmed) {
  return reply.status(400).send({
    ok: false,
    error: 'Explicit user confirmation required (confirmed: true) before sending message.',
  });
}
```

1. **Frontend Barrier:** The `CopilotController` finite state machine only transitions to `success` if the user navigates through `reply_suggestion` → `confirmation` → selects **Confirm Send**.
2. **Backend Barrier:** `POST /api/messages/send` rejects any payload where `confirmed !== true` with HTTP `400 Bad Request`.
3. **Allowlist Barrier:** Even with `confirmed: true`, the destination `chatId` must match an active entry in `monitored_chats` where `enabled = TRUE`. Attempts to send to unauthorized chats return HTTP `403 Forbidden`.

---

## 5. Privacy Policy & Data Minimization

- **No Third-Party Analytics:** The application contains zero third-party tracking scripts, advertising SDKs, or external telemetry.
- **Minimal Retention:** Cached messages (`message_cache`) are stored solely to compute unread digests and AI summaries for the active user session.
- **Clean Disconnect:** When the user unpairs or resets their session, all cached messages, monitored chats, and session records are deleted from the database.
