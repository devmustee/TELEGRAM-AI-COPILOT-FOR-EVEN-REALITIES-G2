# Pitch Deck Notes: Telegram AI Copilot

> **Product:** Telegram AI Copilot for Even Realities G2  
> **Tagline:** One Glance. One Insight. One Action.  
> **Event:** Heads Up Hackathon 2026

---

## 🎯 1. The Core Problem: The Notification Paradox

- **Mobile Overload:** The average knowledge worker receives over 150 Telegram/messaging notifications per day. 90% are chatter, memes, or low-priority status updates.
- **The Screen Dilemma:** Pulling out a smartphone breaks focus, disrupts meetings, and creates cognitive fatigue. Checking a smartwatch requires two hands and awkward wrist twisting.
- **The Smart Glasses Trap:** Simply pushing raw smartphone notifications to smart glasses creates an unbearable strobe of green text right in front of the user's eyes. It causes disorientation and user abandonment.

---

## 💡 2. The Solution: Contextual Heads-Up Intelligence

Telegram AI Copilot is **not a notification mirror**. It is an intelligent cognitive filter:
1. **Intelligent Ingestion:** Streams messages from user-selected Telegram chats in the background.
2. **Priority Scoring Engine:** Evaluates messages based on urgency keywords, question syntax, VIP sender affinity, and time decay.
3. **Glanceable Synthesis:** Compresses dozens of updates into a clean, 3-line green monochrome digest.
4. **Hands-Free Action:** Enables 2-tap contextual AI replies or voice dictation with an ironclad confirmation safety gate.

---

## 📊 3. Hackathon Judging Matrix Alignment

### Criterion 1: Usefulness on G2 (Weight: 30%)
- **Why It Matters:** Smart glasses only succeed if users keep wearing them throughout the day.
- **Our Execution:**
  - Solves the single most frequent digital task: staying on top of critical communications without screen distraction.
  - Allows executives, surgeons, logistics managers, and drivers to stay connected without taking their hands or eyes off their work.
  - Built-in priority engine eliminates 95% of noise, delivering only what truly matters.

### Criterion 2: Read / Write Interaction (Weight: 25%)
- **Why It Matters:** Wearable apps that are "read-only" force users back to their phones.
- **Our Execution:**
  - True bidirectional messaging lifecycle on G2:
    - **Read:** Formatted message cards with sender, chat, timestamp, and byte-safe previews.
    - **Suggest:** AI-generated reply drafts tailored to the conversation context.
    - **Tone Switch:** Temple touchpad swipes toggle between Direct, Professional, and Casual replies.
    - **Dictate:** G2 microphone streams audio for custom voice drafting.
    - **Confirm & Send:** Explicit confirmation screen dispatches the message via MTProto.

### Criterion 3: Technical Execution (Weight: 20%)
- **Why It Matters:** Prototype quality, architecture robustness, and engineering standards.
- **Our Execution:**
  - **Full-Stack Architecture:** Node 22 + Fastify 5 + TypeScript + PostgreSQL 14 + GramJS MTProto.
  - **Even Hub SDK Mastery:** 12 declarative screens, flicker-free `textContainerUpgrade`, zero-omission protobuf fix (`CLICK_EVENT = 0`).
  - **Audio Pipeline:** Transcodes 16 kHz raw PCM into canonical 44-byte RIFF/WAVE header buffers in memory for Whisper STT.
  - **Test Coverage:** 21 automated unit and integration tests passing with 100% success rate.
  - **Official Package:** Validated and stamped into `telegram-ai-copilot.ehpk` (39,336 bytes).

### Criterion 4: Display & Voice UX (Weight: 15%)
- **Why It Matters:** Respecting the G2 hardware constraints (576×288 monochrome HUD).
- **Our Execution:**
  - **Strict Budget Clamping:** Server-side `clampG2Lines` and client-side `formatGlanceLines` guarantee max 3 lines and max 38 characters per line.
  - **No Visual Fatigue:** Monospace-aligned layouts prevent text jitter; high-contrast green monochrome rendering.
  - **Microphone Integration:** Seamless `bridge.audioControl` handling with automatic buffer capping (640 KB max).

### Criterion 5: Business Potential & Safety (Weight: 10%)
- **Why It Matters:** Commercial viability, user trust, and risk mitigation.
- **Our Execution:**
  - **Safety by Design:** Outgoing messages **never auto-send**. Explicit confirmation screen prevents accidental dispatches.
  - **Zero-Credential WebView:** No Telegram secrets or OpenAI keys on wearable storage.
  - **Monetization Model:** Freemium SaaS model ($9.99/month for Pro AI Copilot with unlimited voice transcription, multi-account Telegram, and custom VIP priority rules).

---

## 🥊 4. Why G2 Smart Glasses Beat Smartwatches & Phones

| Dimension | Smartphone | Smartwatch | Even Realities G2 |
| :--- | :--- | :--- | :--- |
| **Eye Contact** | ❌ Breaks eye contact completely | ⚠️ Awkward glance at wrist | ✅ Zero break; heads up and present |
| **Hand Freedom** | ❌ Requires 1 or 2 hands | ❌ Requires opposite hand to operate | ✅ One-tap temple or subtle R1 ring tap |
| **Cognitive Load** | ❌ Infinite rabbit hole of apps | ⚠️ Tiny screen, cramped text | ✅ High-signal 3-line insight |
| **Latency to Action**| 15–20 seconds (unlock, find app, type)| 8–10 seconds (raise wrist, scroll) | **< 3 seconds (glance, confirm, done)** |

---

## 🛣️ 5. Commercial Roadmap

1. **Phase 1 (Current):** Telegram integration for Even Realities G2 (Heads Up Hackathon release).
2. **Phase 2 (Q2 2026):** Multi-channel Unified Inbox (WhatsApp Business, Slack, Discord) using identical 3-line glance architecture.
3. **Phase 3 (Q3 2026):** On-device quantized SLM (Small Language Model) for offline summarization and sub-200ms reply generation.
4. **Phase 4 (Q4 2026):** Native Even R1 Ring micro-gesture mapping (subtle finger thumb-taps for covert message approval during board meetings).
