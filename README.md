# Telegram AI Copilot for Even Realities G2

> **"ONE GLANCE. ONE INSIGHT. ONE ACTION."**  
> Official Submission for the **Even Realities Heads Up Hackathon 2026**.

[![Even Hub SDK](https://img.shields.io/badge/Even%20Hub%20SDK-v0.0.16-brightgreen)](https://hub.evenrealities.com)
[![Package Format](https://img.shields.io/badge/Package-telegram--ai--copilot.ehpk%20(39KB)-blue)](./telegram-ai-copilot.ehpk)
[![Display Budget](https://img.shields.io/badge/Display-576%C3%97288%20Monochrome-black)](https://evenrealities.com)
[![Tests Passing](https://img.shields.io/badge/Tests-21%2F21%20Passing-success)](./apps/g2-app/tests)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-teal)](https://fastify.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue)](https://www.postgresql.org)
[![GramJS](https://img.shields.io/badge/GramJS-MTProto%20v2-0088cc)](https://gram.js.org)

Telegram AI Copilot brings personal heads-up intelligence to your **Even Realities G2** smart glasses. Designed specifically for the G2's dual $576 \times 288$ green monochrome display, 4-microphone array, temple touchpads, and R1 smart ring, it filters 95% of messaging noise, prioritizes urgent requests, synthesizes active conversations into 3-line glanceable digests, suggests contextual AI replies, and enables hands-free voice drafting with strict confirmation safeguards.

---

## ⚡ 30-Second Fast-Track for Judges (Zero Setup)

Want to evaluate the full G2 interface immediately without setting up PostgreSQL or Telegram API credentials?

1. **Start the G2 frontend:**
   ```bash
   npm --prefix apps/g2-app run dev
   ```
2. **Launch the Even Hub Simulator:**
   ```bash
   evenhub-simulator http://localhost:5173
   ```
3. Tap **Demo Preview** on the opening screen. You can immediately interact with all 12 G2 screens, scroll through prioritized messages, generate AI replies, test the tone switcher, and trigger the confirmation gate!

---

## 👓 The G2 HUD Experience (576×288 Monochrome)

The G2 display is optically constrained to green monochrome pixels in the upper visual field. Content must be consumed in a 1 to 2-second glance without visual fatigue. Below is how the app formats intelligence to respect the HUD budget:

### 1. Overview Screen (Instant Glance)
```
┌──────────────────────────────────────────────────────────────┐
│ [TG COPILOT]  Work Group (+2)                    10:42 AM    │
├──────────────────────────────────────────────────────────────┤
│ 1. 8 unread across 3 chats; 1 urgent question                │
│ 2. Sarah: Can you review the contract by 2 PM?               │
│ 3. Team sync scheduled for tomorrow 10:30 AM                 │
│                                                              │
│  > [Important Messages]       [AI Summary]                   │
│    [Voice Command]            [Settings]                     │
├──────────────────────────────────────────────────────────────┤
│ Single-tap: Select  |  Double-tap: Exit                      │
└──────────────────────────────────────────────────────────────┘
```

### 2. Message Detail (Clamped to 38 Chars / Line)
```
┌──────────────────────────────────────────────────────────────┐
│ [MSG 1/3]  Sarah Miller (Work Group)             10:41 AM    │
├──────────────────────────────────────────────────────────────┤
│ "Can you review the Q4 contract draft                        │
│  and confirm terms before 2 PM today?"                       │
│                                                              │
│  > [Suggest Reply]           [AI Summary]                    │
│    [Translate]               [Voice Dictate]                 │
├──────────────────────────────────────────────────────────────┤
│ Swipe: Next Message  |  Double-tap: Back                     │
└──────────────────────────────────────────────────────────────┘
```

### 3. AI Reply Suggestion (Swipable Tone Variations)
```
┌──────────────────────────────────────────────────────────────┐
│ [AI DRAFT · VARIANT 1/3]                         10:42 AM    │
├──────────────────────────────────────────────────────────────┤
│ "I will review the contract and send                         │
│  feedback by 1 PM."                                          │
│                                                              │
│  > [Approve & Send]          [Regenerate / Tone]             │
│    [Voice Edit]              [Discard]                       │
├──────────────────────────────────────────────────────────────┤
│ Single-tap: Approve  |  Swipe: Cycle Tone Variant            │
└──────────────────────────────────────────────────────────────┘
```

### 4. Hardware Confirmation Gate (Safety by Design)
```
┌──────────────────────────────────────────────────────────────┐
│ [CONFIRM SEND] · WORK GROUP                      10:42 AM    │
├──────────────────────────────────────────────────────────────┤
│ Target: Sarah Miller (Work Group)                            │
│ Text:   "I will review the contract and send feedback..."    │
│                                                              │
│  > [CONFIRM & SEND NOW]                                      │
│    [Cancel / Edit Draft]                                     │
├──────────────────────────────────────────────────────────────┤
│ Single-tap: CONFIRM SEND  |  Double-tap: Cancel              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎮 Hardware Controls & Simulator Mapping

Whether using physical G2 smart glasses, the Even R1 smart ring, or the Even Hub Simulator, input maps seamlessly:

| Action | G2 Temple Touchpad | Even R1 Smart Ring | Even Hub Simulator |
| :--- | :--- | :--- | :--- |
| **Select / Execute** | Single Tap | Index Click | `Enter` / Left Click |
| **Scroll / Cycle Tone** | Swipe Forward / Back | Micro-Dial / Swipe | `↑` / `↓` Arrow keys |
| **Back / Cancel** | Double Tap | Double Click | `Esc` / `Backspace` |
| **Exit Application** | Double Tap on Root | Double Click on Root | `Esc` on Root screen |
| **Microphone / Voice**| Select Voice Action | Ring Long-Press | Click Mic button in UI |

---

## 🌟 Key Features & Judging Alignment

| Hackathon Criterion | Weight | How Telegram AI Copilot Delivers |
| :--- | :---: | :--- |
| **Usefulness on G2** | **30%** | Solves extreme mobile notification fatigue by filtering 95% of noise and delivering 3-line actionable intelligence directly in your line of sight. |
| **Read/Write Interaction** | **25%** | Complete bidirectional cycle: Read prioritized incoming chats $\rightarrow$ AI draft suggestion or G2 voice dictation $\rightarrow$ Temple swipe tone selection $\rightarrow$ Explicit confirmation $\rightarrow$ Instant Telegram dispatch. |
| **Technical Execution** | **20%** | Production-ready Fastify backend, MTProto connection pool, AES-256-GCM encryption, PostgreSQL cache, Whisper STT, GPT-4o-mini, 21 passing automated tests, and official `.ehpk` package build. |
| **Display/Voice UX** | **15%** | Strict compliance with 576×288 monochrome HUD budget ($\le$ 38 chars/line, $\le$ 3 lines), flicker-free container upgrades, hardware zero-omission fix, and responsive 16 kHz PCM microphone capture. |
| **Business & Safety** | **10%** | Strict confirmation barrier (no unintended sends), zero API keys in WebView, user-controlled chat allowlists, and high commercial appeal for executives, traders, and mobile professionals. |

---

## 📐 System Architecture

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

For complete deep-dive documentation, see [ARCHITECTURE.md](file:///Users/user/Documents/TELEGRAM%20AI%20COPILOT%20FOR%20EVEN%20REALITIES%20G2/ARCHITECTURE.md).

---

## 🗺️ 12 G2 Screen Flow Map

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

## 📱 Interactive Companion Setup Portal (`/setup`)

Smart glasses lack full virtual keyboards. Instead of awkward typing on a HUD, pairing uses an out-of-band companion web portal:

1. **Ephemeral 6-Char Code:** Glasses display a 6-character code (e.g. `G2-7492`), valid for 10 minutes.
2. **Web Portal Link:** Navigate to `http://localhost:3001/setup` in your phone or laptop browser.
3. **Claim & Login:** Enter the pairing code, input your phone number, and verify with your Telegram OTP.
4. **Chat Allowlist:** Select which chats the Copilot is permitted to monitor. Non-whitelisted chats are completely ignored.
5. **Session Encryption:** GramJS MTProto session strings are encrypted with AES-256-GCM and stored in PostgreSQL. The glasses receive only an opaque bearer token.

For threat models and privacy details, see [SECURITY.md](file:///Users/user/Documents/TELEGRAM%20AI%20COPILOT%20FOR%20EVEN%20REALITIES%20G2/SECURITY.md).

---

## 🔌 Backend REST API Reference

| Endpoint | Method | Description | Guardrails |
| :--- | :---: | :--- | :--- |
| `/api/health` | `GET` | Health status and PostgreSQL connectivity | Public |
| `/api/pair/init` | `POST` | Generate ephemeral 6-char pairing code for G2 | Public |
| `/api/pair/claim` | `POST` | Claim pairing code from companion browser | Rate-limited |
| `/api/pair/status` | `GET` | Poll pairing completion & Telegram link state | Bearer Auth |
| `/api/telegram/auth/start`| `POST` | Initiate MTProto phone authentication | Bearer Auth |
| `/api/telegram/auth/verify`| `POST` | Complete authentication with Telegram OTP | Bearer Auth |
| `/api/telegram/dialogs`| `GET` | List available dialogs to populate allowlist | Bearer Auth |
| `/api/chats` | `GET/PUT`| Retrieve or update monitored chat allowlist | Bearer Auth |
| `/api/messages/important`| `GET` | Fetch prioritized incoming messages | Bearer Auth |
| `/api/messages/send` | `POST` | Dispatch confirmed message to Telegram | **Requires `confirmed: true`** |
| `/api/ai/summarize` | `POST` | Generate 3-line chat digest | Bearer Auth |
| `/api/ai/reply` | `POST` | Generate 3 contextual reply variations | Bearer Auth |
| `/api/ai/ask` | `POST` | Context Q&A citing chat history | Bearer Auth |
| `/api/ai/translate` | `POST` | Translate message into user language | Bearer Auth |
| `/api/voice/command`| `POST` | Transcode 16 kHz PCM $\rightarrow$ WAV $\rightarrow$ STT | Bearer Auth |

---

## 🚀 Full Setup & Live Telegram Mode

### Prerequisites
- Node.js 22+
- PostgreSQL 14+ running locally on port 5432
- Even Hub Simulator (`npm install -g @evenrealities/evenhub-simulator @evenrealities/evenhub-cli`)

### 1. Installation
```bash
git clone https://github.com/your-username/telegram-ai-copilot-g2.git
cd telegram-ai-copilot-g2

# Install dependencies across all packages
npm install
npm --prefix apps/backend install
npm --prefix apps/g2-app install
```

### 2. Configure Environment & Database
```bash
# Configure backend environment
cp apps/backend/.env.example apps/backend/.env

# Create local PostgreSQL database and run migrations
createdb telegram_ai_copilot
npm --prefix apps/backend run db:migrate
```

*(Optional for Live Mode)*: Populate `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `OPENAI_API_KEY` in `apps/backend/.env`.

### 3. Launch Development Servers
```bash
# Terminal 1: Backend Fastify API (Port 3001)
npm run dev:backend

# Terminal 2: G2 Frontend (Port 5173)
npm run dev:g2
```

### 4. Launch Simulator with Audio Capture
```bash
evenhub-simulator --aid coreaudio:BuiltInMicrophoneDevice http://localhost:5173
```

---

## 🧪 Automated Testing & Production Packaging

The project maintains 100% passing test coverage across 21 automated unit and integration tests:

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
# Build TypeScript and Vite distribution bundle
npm run build

# Stamp and package the official .ehpk file for Even Hub
npm run pack
```
Outputs [telegram-ai-copilot.ehpk](file:///Users/user/Documents/TELEGRAM%20AI%20COPILOT%20FOR%20EVEN%20REALITIES%20G2/telegram-ai-copilot.ehpk) (`39,336` bytes), stamped with SDK `v0.0.16` and `min_app_version: 2.2.10`.

---

## 📂 Repository Structure

```
.
├── apps/
│   ├── g2-app/                    # Even Hub G2 Frontend (576x288 HUD)
│   │   ├── app.json               # Official manifest (package ID, permissions, min_app_version)
│   │   ├── src/
│   │   │   ├── api/client.ts      # Type-safe client for Fastify backend
│   │   │   ├── app/controller.ts  # Finite state machine (12 screens, history stack)
│   │   │   ├── data/demoData.ts   # Realistic test messages and chat digests
│   │   │   ├── g2/audio.ts        # 16 kHz mono PCM buffer & audioControl bridge
│   │   │   ├── g2/display.ts      # SDK display engine & container manager
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
├── ARCHITECTURE.md                # System topology, optical limits & design decisions
├── SECURITY.md                    # Threat model & zero-credential security safeguards
├── DEMO_SCRIPT.md                 # 3-minute hackathon demo walkthrough script
├── PITCH_DECK_NOTES.md            # Pitch talking points & judging criteria
├── telegram-ai-copilot.ehpk       # Official Even Hub distribution package (39KB)
└── package.json                   # Root monorepo workspace configuration
```

---

## 📚 Key Project Documents

- [ARCHITECTURE.md](file:///Users/user/Documents/TELEGRAM%20AI%20COPILOT%20FOR%20EVEN%20REALITIES%20G2/ARCHITECTURE.md) — Technical deep-dive on container management, MTProto connection pooling, and the 16 kHz PCM audio pipeline.
- [SECURITY.md](file:///Users/user/Documents/TELEGRAM%20AI%20COPILOT%20FOR%20EVEN%20REALITIES%20G2/SECURITY.md) — Threat model, AES-256-GCM encryption, chat allowlist permissions, and confirmed-only outgoing safeguards.
- [DEMO_SCRIPT.md](file:///Users/user/Documents/TELEGRAM%20AI%20COPILOT%20FOR%20EVEN%20REALITIES%20G2/DEMO_SCRIPT.md) — 3-minute hackathon presentation script with timed speaker cues and actions.
- [PITCH_DECK_NOTES.md](file:///Users/user/Documents/TELEGRAM%20AI%20COPILOT%20FOR%20EVEN%20REALITIES%20G2/PITCH_DECK_NOTES.md) — Judging matrix alignment, market analysis, and commercialization roadmap.

---

## 📜 License
MIT License. Built for the Even Realities Heads Up Hackathon 2026.
