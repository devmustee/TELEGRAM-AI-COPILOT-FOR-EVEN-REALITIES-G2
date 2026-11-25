# Telegram AI Copilot for Even Realities G2

> **"ONE GLANCE. ONE INSIGHT. ONE ACTION."**  
> Heads Up Hackathon 2026 Submission for Even Realities G2 Smart Glasses.

[![Even Hub SDK](https://img.shields.io/badge/Even%20Hub%20SDK-v0.0.16-brightgreen)](https://hub.evenrealities.com)
[![G2 Display](https://img.shields.io/badge/Display-576%C3%97288%20Monochrome-black)](https://evenrealities.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-teal)](https://fastify.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue)](https://www.postgresql.org)
[![GramJS](https://img.shields.io/badge/GramJS-MTProto-0088cc)](https://gram.js.org)

Telegram AI Copilot brings personal heads-up intelligence to your Even Realities G2 smart glasses. Designed specifically for the G2's dual 576×288 green monochrome display, 4-microphone array, temple touchpads, and R1 smart ring, it filters notification noise, prioritizes urgent messages, synthesizes unread chats into 3-line glanceable digests, suggests contextual replies, and enables hands-free voice drafting with strict confirmation safeguards.

---

## 🌟 Key Features

1. **Glanceable Intelligence (30% Criteria):**
   - Instant high-priority digests clamped strictly to 3 lines (max 38 characters/line) to prevent HUD clutter while walking or working.
   - Smart priority scoring engine ranking questions, action items, and VIP chats above routine group chatter.

2. **Complete Read-to-Write Flow (25% Criteria):**
   - Read prioritized incoming messages directly on the G2 HUD.
   - Generate AI reply suggestions or dictate responses using the G2 4-mic array (16 kHz mono PCM).
   - Cycle through AI tone variations with temple swipes.
   - Review drafts in a dedicated confirmation screen before dispatch.

3. **Strict Safety & Confirmation Guardrails (10% Criteria):**
   - **Never auto-sends:** Outgoing messages require explicit, deliberate confirmation on G2 hardware (touchpad click or R1 ring tap).
   - **Chat allowlist:** Only chats explicitly enabled by the user in the `/setup` companion portal are monitored.

4. **Zero-Credential WebView Architecture (20% Criteria):**
   - Smart glasses WebView holds zero API keys and zero Telegram secrets.
   - Pairing occurs via an ephemeral 6-character code (`/setup`) in your desktop/mobile browser.
   - Telegram MTProto credentials encrypted at rest with AES-256-GCM in PostgreSQL.

5. **Display & Voice UX Tailored for G2 (15% Criteria):**
   - Supports 12 distinct G2 screens: Welcome, Connect, Pairing, Overview, Important Messages, Message Detail, AI Summary, Reply Suggestion, Voice Recording, Confirmation, Success, and Error.
   - Handles protobuf wire zero-omission (`CLICK_EVENT = 0` / list index `0` arriving as `undefined`).
   - Flicker-free text upgrades via `textContainerUpgrade` and strict container budgets (<=8 text, <=4 list containers).
   - Built-in full **Demo Mode** allowing complete evaluation without requiring live Telegram or OpenAI credentials.

---

## 📐 Architecture Overview

```
                                      ┌─────────────────────────────────────┐
                                      │        Companion Browser            │
                                      │     http://localhost:3001/setup      │
                                      │  (6-Char Code + Phone/OTP Login)    │
                                      └──────────────────┬──────────────────┘
                                                         │ AES-256-GCM Session
                                                         ▼
┌─────────────────────────┐   BLE Envelope   ┌─────────────────────────────────────┐
│   Even Realities G2     │ ◄──────────────► │           Fastify Backend           │
│      Smart Glasses      │  WebSocket / HTTP│          (Port 3001 / Node 22)      │
│  - 576x288 Green HUD    │                  ├─────────────────────────────────────┤
│  - 4-Mic PCM Stream     │                  │ • Pairing & Auth (Bearer Tokens)    │
│  - Touchpad / R1 Ring   │                  │ • GramJS MTProto Client Pool        │
│  - 12 Screen State Mach │                  │ • AI Engine (Whisper + GPT-4o-mini) │
│  - Truncation & Budgets │                  │ • Priority & Message Scoring        │
└─────────────────────────┘                  └──────────────┬──────────────────────┘
                                                            │
                                             ┌──────────────┴──────────────┐
                                             ▼                             ▼
                                  ┌────────────────────┐        ┌────────────────────┐
                                  │   Local PostgreSQL │        │  Telegram MTProto  │
                                  │ (Encrypted Sessions│        │    & OpenAI APIs   │
                                  │   & Cached Chats)  │        └────────────────────┘
                                  └────────────────────┘
```

---

## 🗺️ 12 G2 Screen Flow

```
                      ┌───────────────┐
                      │    Welcome    │
                      └───────┬───────┘
                              │ Click
                              ▼
                      ┌───────────────┐
                      │Connect/Select ├─────────────┐
                      └───────┬───────┘             │
                Live Pair     │                     │ Demo Mode
                              ▼                     ▼
                      ┌───────────────┐      ┌───────────────┐
                      │ Pairing Code  │      │   Overview    │◄─────────────┐
                      └───────┬───────┘      └───────┬───────┘              │
                        Paired│                      │                      │
                              └──────────────────────┤                      │
                                                     │                      │
                  ┌─────────────────┬────────────────┴────────────────┐     │
                  ▼                 ▼                                 ▼     │
          ┌───────────────┐ ┌───────────────┐                 ┌─────────────┴─┐
          │   Important   │ │  AI Summary   │                 │Voice Recording│
          │   Messages    │ └───────┬───────┘                 └───────┬───────┘
          └───────┬───────┘         │                                 │
            Click │                 └─────────────────┐               │
                  ▼                                   ▼               ▼
          ┌───────────────┐                   ┌───────────────┐ ┌─────────────┐
          │Message Detail ├──────────────────►│Reply Suggest  │ │ AI Intent / │
          └───────┬───────┘                   └───────┬───────┘ │ Voice Draft │
                  │                                   │         └──────┬──────┘
                  │                                   │ Approve        │
                  │                                   ▼                │
                  │                           ┌───────────────┐        │
                  │                           │ Confirmation  │◄───────┘
                  │                           └───────┬───────┘
                  │                                   │ Confirm Send (R1 / Click)
                  │                                   ▼
                  │                           ┌───────────────┐
                  │                           │ Success Screen│
                  │                           └───────┬───────┘
                  │                                   │ Any Click
                  └───────────────────────────────────┴─────────────────────────┘
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 22+
- PostgreSQL 14+ running locally on port 5432
- Even Hub Simulator (`npm install -g @evenrealities/evenhub-simulator @evenrealities/evenhub-cli`)

### 1. Clone & Install
```bash
git clone https://github.com/your-username/telegram-ai-copilot-g2.git
cd telegram-ai-copilot-g2

# Install root, backend, and frontend dependencies
npm install
npm --prefix apps/backend install
npm --prefix apps/g2-app install
```

### 2. Configure Environment & Database
```bash
# Copy example environment configuration
cp apps/backend/.env.example apps/backend/.env

# Create local PostgreSQL database and run migrations
createdb telegram_ai_copilot
npm --prefix apps/backend run db:migrate
```

*(Optional for Live Mode)*: Add your `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `OPENAI_API_KEY` into `apps/backend/.env`. If omitted, the app runs in **Demo Mode** seamlessly with full mock data.

### 3. Start Development Servers
In terminal 1 (Backend API on port 3001):
```bash
npm run dev:backend
```

In terminal 2 (G2 Vite Frontend on port 5173):
```bash
npm run dev:g2
```

### 4. Launch the Even Hub Simulator
```bash
npm run sim
# Or with microphone support for voice commands:
evenhub-simulator --aid coreaudio:BuiltInMicrophoneDevice http://localhost:5173
```

---

## 🧪 Testing & Verification

The project includes an exhaustive test suite covering display boundaries, hardware event normalization, controller state transitions, GramJS encryption, AI clamping, voice PCM transcoding, and confirmed-send guardrails:

```bash
# Run all G2 unit & controller simulation tests (12 tests)
npm run test:g2

# Run all backend integration tests (9 tests)
npm run test:backend

# Run full test suite across both apps (21 tests)
npm run test
```

### Production Build & Packaging
```bash
# Build backend TypeScript and frontend Vite bundle
npm run build

# Stamp and package the official .ehpk package for G2 glasses
npm run pack
```
Outputs `telegram-ai-copilot.ehpk` (39,336 bytes), ready for deployment to Even Hub.

---

## 📱 Companion Setup Portal (`/setup`)

When pairing live glasses:
1. Open the G2 app; it displays an ephemeral 6-character code (e.g., `G2-7492`).
2. Navigate to `http://localhost:3001/setup` on your desktop or mobile browser.
3. Enter the pairing code to authorize the session.
4. Sign in with your phone number, receive your Telegram OTP, and select which chats the G2 Copilot is permitted to monitor.
5. The G2 glasses immediately wake up, load the prioritized digest, and connect.

---

## 📂 Project Structure

```
.
├── apps/
│   ├── g2-app/                    # Even Hub G2 Frontend (576x288 HUD)
│   │   ├── app.json               # App manifest (package ID, permissions, min_app_version)
│   │   ├── src/
│   │   │   ├── api/client.ts      # Type-safe API client for Fastify backend
│   │   │   ├── app/controller.ts  # Finite state machine (12 screens, history stack)
│   │   │   ├── data/demoData.ts   # Realistic Telegram test dataset
│   │   │   ├── g2/audio.ts        # 16 kHz mono PCM buffer & audioControl bridge
│   │   │   ├── g2/display.ts      # Even Hub SDK display engine & container manager
│   │   │   ├── g2/formatter.ts    # Byte-safe UTF-8 truncation & line budget wrapper
│   │   │   ├── g2/input.ts        # Hardware input normalizer (click, scroll, double_click)
│   │   │   ├── g2/screens.ts      # Declarative layout definitions for all 12 screens
│   │   │   └── types/copilot.ts   # Core TypeScript interfaces
│   │   └── tests/
│   │       ├── g2.test.ts         # Display, formatter, and protobuf event tests
│   │       └── controller.test.ts # End-to-end 12-screen controller simulation tests
│   │
│   └── backend/                   # Fastify Node 22 API
│       ├── schema.sql             # PostgreSQL schema (users, sessions, chats, cache)
│       ├── src/
│       │   ├── routes/            # Pairing, Telegram auth, messages, AI, voice routes
│       │   ├── security/          # AES-256-GCM crypto & bearer token authentication
│       │   └── services/          # GramJS pool, AI summarizer, voice transcoder
│       └── tests/                 # Integration tests (auth, crypto, AI schemas, voice)
│
├── ARCHITECTURE.md                # Detailed system architecture & design decisions
├── SECURITY.md                    # Threat model & zero-credential security safeguards
├── DEMO_SCRIPT.md                 # 3-minute hackathon demo walkthrough script
├── PITCH_DECK_NOTES.md            # Hackathon pitch talking points & judging criteria
├── telegram-ai-copilot.ehpk       # Compiled Even Hub distribution package
└── package.json                   # Root monorepo workspace configuration
```

---

## 🏆 Hackathon Judging Alignment

| Judging Criterion | Weight | How Telegram AI Copilot Delivers |
| :--- | :---: | :--- |
| **Usefulness on G2** | **30%** | Solves extreme mobile notification fatigue by filtering 95% of noise and delivering 3-line actionable intelligence directly in your line of sight. |
| **Read/Write Interaction** | **25%** | Complete bidirectional cycle: Read prioritized incoming chats -> AI draft suggestion or G2 voice dictation -> Temple swipe tone selection -> Explicit confirmation -> Instant Telegram dispatch. |
| **Technical Execution** | **20%** | Production-ready Fastify backend, MTProto connection pool, AES-256-GCM encryption, PostgreSQL cache, Whisper STT, GPT-4o-mini, 21 passing automated tests, and official `.ehpk` package build. |
| **Display/Voice UX** | **15%** | Strict compliance with 576×288 monochrome HUD budget (<=38 chars/line, <=3 lines), flicker-free container upgrades, hardware zero-omission fix, and responsive 16 kHz PCM microphone capture. |
| **Business & Safety** | **10%** | Strict confirmation barrier (no unintended sends), zero API keys in WebView, user-controlled chat allowlists, and high commercial appeal for executives, traders, and mobile professionals. |

---

## 📜 License
MIT License. Built for the Even Realities Heads Up Hackathon 2026.
# TELEGRAM-AI-COPILOT-FOR-EVEN-REALITIES-G2
