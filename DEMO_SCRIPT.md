# 3-Minute Hackathon Demo Script: Telegram AI Copilot

> **Theme:** "ONE GLANCE. ONE INSIGHT. ONE ACTION."  
> **Target Audience:** Heads Up Hackathon 2026 Judges  
> **Duration:** 3 Minutes  
> **Hardware / Simulation:** Even Realities G2 Glasses / Simulator (`evenhub-simulator http://localhost:5173`)

---

## 🎬 Demo Setup Checklist

Before presenting to the judges:
1. Terminal 1 running backend: `npm run dev:backend` (Port 3001)
2. Terminal 2 running frontend: `npm run dev:g2` (Port 5173)
3. Terminal 3 running simulator:
   ```bash
   evenhub-simulator --aid coreaudio:BuiltInMicrophoneDevice http://localhost:5173
   ```
4. Optional companion browser open at `http://localhost:3001/setup` (for showing the companion pairing portal).

---

## ⏱️ Minute 0:00 – 0:30 | The Hook & Problem Statement

**Speaker Action:** Stand naturally wearing G2 glasses (or display the G2 Simulator window on screen).

**Spoken Script:**
> *"Smart glasses promise to free our eyes from our smartphones. But what happens today when you connect your messaging apps? You get bombarded with notifications—every emoji reaction, every group meme, every spam blast vibrates right in your face. It's overwhelming, exhausting, and dangerous while driving or walking.*
>
> *Introducing **Telegram AI Copilot** for the Even Realities G2. Our core design philosophy is: **ONE GLANCE. ONE INSIGHT. ONE ACTION.**
>
> *We turn the firehose of Telegram into a whisper of actionable intelligence—right in your line of sight, strictly constrained to the G2's green monochrome optical budget."*

---

## ⏱️ Minute 0:30 – 1:15 | Glanceable Read Flow (30% Usefulness)

**Speaker Action:** On the Simulator or G2 temple touchpad, tap to enter Demo Preview.

**Spoken Script:**
> *"Let's look at the display. When I wake up the Copilot, I'm greeted by the Overview screen. Notice how clean this is: exactly three lines of text, perfectly formatted for the 576×288 HUD.
>
> In one second, I know that across 3 work chats, I have 8 unread messages, but only **one** requires my immediate attention.
>
> Let's tap into **Important Messages**. Our backend prioritizer automatically filtered out all group noise and elevated a direct question from Sarah: *'Can you review the contract before 2 PM today?'*
>
> I can scroll down with a subtle temple swipe to see other prioritized messages—like John asking about tomorrow's sync—all formatted strictly to 38 characters per line so I never experience eye strain or visual clutter."*

---

## ⏱️ Minute 1:15 – 2:00 | The AI Reply & Tone Swiping (25% Read/Write)

**Speaker Action:** Tap on Sarah's message to view Message Detail, then select **Suggest Reply**.

**Spoken Script:**
> *"Now comes the magic: the Read-to-Write loop. I don't need to pull out my phone to respond.
>
> I simply tap **Suggest Reply**. Our backend AI engine immediately analyzes Sarah's question and drafts a contextual response:
> *'I will review the contract and send feedback by 1 PM.'*
>
> What if I want a different tone? I swipe forward to regenerate:
> - *Variant 1:* 'Looking at it now, will approve shortly.'
> - *Variant 2:* 'On it. Will ping you once done.'
>
> I pick the one I like and tap **Approve & Send**."*

---

## ⏱️ Minute 2:00 – 2:30 | Safety & The Hardware Confirmation Gate (10% Safety)

**Speaker Action:** The G2 screen transitions to the **Confirmation Screen**.

**Spoken Script:**
> *"Now, pay close attention to this screen. In heads-up computing, **safety is paramount**.
>
> Wearable AI should **never auto-send** messages on assumptions. A stray tap or a misheard word shouldn't embarrass you in front of your team or clients.
>
> That's why Telegram AI Copilot features a mandatory **Confirmation Gate**. You clearly see the destination chat, the sender, and the exact text.
>
> With a single deliberate press on the temple or a tap on the Even R1 smart ring... **CONFIRM SEND**.
>
> The message is dispatched through our encrypted MTProto client directly to Telegram. The G2 displays a clean confirmation badge: *Sent to Sarah Miller*, and returns gracefully to the Overview."*

---

## ⏱️ Minute 2:30 – 3:00 | Voice Dictation & Architecture Highlights (20% Tech)

**Speaker Action:** From Overview, select **Voice Command** and speak a command.

**Spoken Script:**
> *"We also leverage the G2's built-in 4-microphone array. When I tap Voice Command, the app streams raw 16 kHz mono PCM over BLE to our backend.
>
> Our custom transcoder packages it with a canonical 44-byte WAV header and feeds Whisper STT and GPT-4o-mini intent parsing. I can ask: *'Summarize work chat'* or dictate a custom reply hands-free.
>
> Under the hood:
> - **Zero-Credential Security:** Zero Telegram credentials or API keys ever enter the G2 glasses.
> - **AES-256-GCM Encryption:** Session strings are encrypted at rest in PostgreSQL.
> - **Tested & Packaged:** 21 automated unit and integration tests passing, and fully packaged into the official `.ehpk` format for Even Hub deployment.
>
> Telegram AI Copilot gives you your time, focus, and sanity back. One glance. One insight. One action. Thank you!"*
