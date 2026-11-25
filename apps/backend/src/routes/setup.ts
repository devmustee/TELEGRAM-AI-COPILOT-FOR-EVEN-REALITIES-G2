import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';

export async function registerSetupRoutes(app: FastifyInstance): Promise<void> {
  app.get('/setup', async (_request, reply) => {
    const telegramConfigured = Boolean(env.TELEGRAM_API_ID && env.TELEGRAM_API_HASH);

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Telegram AI Copilot — Companion Setup</title>
    <style>
      :root {
        --bg: #0b0f0d;
        --card: #101814;
        --border: #1f3b2c;
        --green: #7dffb3;
        --muted: #9bc0aa;
        --text: #e6f4ea;
        --warn: #ffd166;
        --err: #ff6b6b;
      }
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: var(--bg);
        color: var(--text);
        margin: 0;
        padding: 1.5rem 1rem 3rem;
      }
      main {
        max-width: 560px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      section {
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 1.25rem;
        background: var(--card);
      }
      h1 { margin: 0 0 0.4rem; color: var(--green); font-size: 1.35rem; }
      h2 { margin: 0 0 0.75rem; font-size: 1.05rem; color: var(--green); }
      p { margin: 0.25rem 0 0.75rem; color: var(--muted); line-height: 1.45; font-size: 0.92rem; }
      label { display: block; font-size: 0.85rem; color: var(--muted); margin-bottom: 0.3rem; }
      input, select {
        width: 100%;
        padding: 0.65rem 0.75rem;
        border-radius: 8px;
        border: 1px solid #284b38;
        background: #0a120e;
        color: var(--text);
        font-size: 0.95rem;
        margin-bottom: 0.75rem;
      }
      button {
        background: #1c5c39;
        color: #f2fff7;
        border: 1px solid #2d8a57;
        border-radius: 8px;
        padding: 0.65rem 1rem;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.92rem;
      }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      .secondary { background: #14221a; border-color: #264a35; }
      .hidden { display: none; }
      .msg { font-size: 0.88rem; margin-top: 0.5rem; }
      .msg.ok { color: var(--green); }
      .msg.err { color: var(--err); }
      .msg.warn { color: var(--warn); }
      .chat-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.55rem 0;
        border-bottom: 1px solid #193023;
      }
      .chat-left { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
      .chat-left input[type="checkbox"] { width: auto; margin: 0; }
      .chat-title { font-weight: 600; font-size: 0.92rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .chat-meta { font-size: 0.78rem; color: var(--muted); }
      .prio { width: 92px; margin: 0; padding: 0.35rem; font-size: 0.82rem; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>Telegram AI Copilot — Companion Setup</h1>
        <p>Authenticate on your phone or laptop so Telegram credentials never touch the G2 WebView.</p>
        ${
          telegramConfigured
            ? ''
            : '<p class="msg warn">Note: <code>TELEGRAM_API_ID</code> / <code>TELEGRAM_API_HASH</code> are not configured in backend <code>.env</code> yet. Pairing works, and Telegram sign-in will activate once those keys are added.</p>'
        }
      </section>

      <section id="step-pair">
        <h2>1. Pair G2 Glasses</h2>
        <label for="pair-code">Enter 6-character code shown on G2</label>
        <input id="pair-code" type="text" maxlength="12" placeholder="e.g. K7M4P9" autocomplete="off" />
        <button id="btn-claim">Pair Device</button>
        <div id="pair-msg" class="msg"></div>
      </section>

      <section id="step-telegram" class="hidden">
        <h2>2. Connect Telegram Account</h2>
        <p>Uses official Telegram MTProto client authorization. Only chats you select below will be monitored.</p>
        <div id="tg-phone-box">
          <label for="tg-phone">Phone number (with country code)</label>
          <input id="tg-phone" type="tel" placeholder="+15551234567" />
          <button id="btn-send-code">Send Login Code</button>
        </div>
        <div id="tg-code-box" class="hidden">
          <label for="tg-code">Telegram verification code</label>
          <input id="tg-code" type="text" inputmode="numeric" placeholder="12345" />
          <div id="tg-2fa-box" class="hidden">
            <label for="tg-password">Two-Step Verification (2FA) password</label>
            <input id="tg-password" type="password" placeholder="2FA Cloud Password" />
          </div>
          <button id="btn-verify-code">Verify & Connect</button>
        </div>
        <div id="tg-msg" class="msg"></div>
      </section>

      <section id="step-chats" class="hidden">
        <h2>3. Select Monitored Chats & Priority</h2>
        <p>Choose up to 10 chats, groups, or channels for G2 intelligence.</p>
        <div id="chat-list">Loading dialogs...</div>
        <div style="margin-top: 0.9rem; display: flex; gap: 0.6rem;">
          <button id="btn-save-chats">Save Monitored Chats</button>
          <button id="btn-reload-chats" class="secondary">Reload</button>
        </div>
        <div id="chats-msg" class="msg"></div>
      </section>
    </main>

    <script>
      let setupToken = sessionStorage.getItem('copilot_setup_token') || '';
      let dialogs = [];

      const $ = (id) => document.getElementById(id);
      const setMsg = (id, text, cls) => {
        const el = $(id);
        el.textContent = text;
        el.className = 'msg ' + (cls || '');
      };

      async function api(path, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        if (setupToken) headers['Authorization'] = 'Bearer ' + setupToken;
        const res = await fetch(path, { ...options, headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || ('HTTP ' + res.status));
        return data;
      }

      if (setupToken) {
        $('step-telegram').classList.remove('hidden');
        setMsg('pair-msg', 'Session active. Continue with Telegram sign-in.', 'ok');
      }

      $('btn-claim').addEventListener('click', async () => {
        const code = $('pair-code').value.trim().toUpperCase();
        if (!code) return setMsg('pair-msg', 'Enter your pairing code.', 'err');
        try {
          const data = await api('/api/pair/claim', {
            method: 'POST',
            body: JSON.stringify({ code }),
          });
          setupToken = data.setupToken;
          sessionStorage.setItem('copilot_setup_token', setupToken);
          setMsg('pair-msg', 'Device paired! Proceed to step 2.', 'ok');
          $('step-telegram').classList.remove('hidden');
        } catch (err) {
          setMsg('pair-msg', err.message, 'err');
        }
      });

      $('btn-send-code').addEventListener('click', async () => {
        const phoneNumber = $('tg-phone').value.trim();
        if (!phoneNumber) return setMsg('tg-msg', 'Enter a phone number.', 'err');
        try {
          $('btn-send-code').disabled = true;
          setMsg('tg-msg', 'Sending verification code...', '');
          await api('/api/telegram/auth/start', {
            method: 'POST',
            body: JSON.stringify({ phoneNumber }),
          });
          $('tg-code-box').classList.remove('hidden');
          setMsg('tg-msg', 'Code sent via Telegram. Enter it below.', 'ok');
        } catch (err) {
          setMsg('tg-msg', err.message, 'err');
        } finally {
          $('btn-send-code').disabled = false;
        }
      });

      $('btn-verify-code').addEventListener('click', async () => {
        const code = $('tg-code').value.trim();
        const password = $('tg-password').value;
        if (!code) return setMsg('tg-msg', 'Enter the login code.', 'err');
        try {
          $('btn-verify-code').disabled = true;
          const data = await api('/api/telegram/auth/verify', {
            method: 'POST',
            body: JSON.stringify({ code, password: password || undefined }),
          });
          if (data.step === 'password_required') {
            $('tg-2fa-box').classList.remove('hidden');
            setMsg('tg-msg', '2FA password required. Enter password and click Verify again.', 'warn');
            return;
          }
          setMsg('tg-msg', 'Connected as ' + (data.phoneMasked || 'Telegram user') + '!', 'ok');
          $('step-chats').classList.remove('hidden');
          await loadDialogs();
        } catch (err) {
          setMsg('tg-msg', err.message, 'err');
        } finally {
          $('btn-verify-code').disabled = false;
        }
      });

      async function loadDialogs() {
        const listEl = $('chat-list');
        listEl.textContent = 'Loading Telegram chats...';
        try {
          const [dlgRes, savedRes] = await Promise.all([
            api('/api/telegram/dialogs'),
            api('/api/chats'),
          ]);
          dialogs = dlgRes.dialogs || [];
          const savedMap = new Map((savedRes.chats || []).map((c) => [c.telegramChatId, c]));
          if (dialogs.length === 0) {
            listEl.textContent = 'No chats returned.';
            return;
          }
          listEl.innerHTML = '';
          for (const d of dialogs) {
            const saved = savedMap.get(d.chatId);
            const row = document.createElement('div');
            row.className = 'chat-row';
            row.innerHTML = \`
              <div class="chat-left">
                <input type="checkbox" data-chat-id="\${d.chatId}" \${saved?.enabled ? 'checked' : ''} />
                <div>
                  <div class="chat-title"></div>
                  <div class="chat-meta">\${d.chatType} · \${d.unreadCount} unread</div>
                </div>
              </div>
              <select class="prio" data-prio-id="\${d.chatId}">
                <option value="1" \${(saved?.priorityWeight || 1) === 1 ? 'selected' : ''}>Normal (1)</option>
                <option value="2" \${saved?.priorityWeight === 2 ? 'selected' : ''}>High (2)</option>
                <option value="3" \${saved?.priorityWeight === 3 ? 'selected' : ''}>VIP (3)</option>
              </select>
            \`;
            row.querySelector('.chat-title').textContent = d.title;
            listEl.appendChild(row);
          }
        } catch (err) {
          listEl.textContent = 'Error loading chats: ' + err.message;
        }
      }

      $('btn-reload-chats').addEventListener('click', loadDialogs);

      $('btn-save-chats').addEventListener('click', async () => {
        const checked = Array.from(document.querySelectorAll('input[data-chat-id]:checked'));
        if (checked.length > 10) {
          return setMsg('chats-msg', 'Select at most 10 chats.', 'err');
        }
        const chats = checked.map((el) => {
          const chatId = el.getAttribute('data-chat-id');
          const dlg = dialogs.find((d) => d.chatId === chatId);
          const prioEl = document.querySelector('select[data-prio-id="' + chatId + '"]');
          return {
            telegramChatId: chatId,
            title: dlg ? dlg.title : chatId,
            chatType: dlg ? dlg.chatType : 'group',
            priorityWeight: Number(prioEl ? prioEl.value : 1),
            enabled: true,
          };
        });
        try {
          await api('/api/chats', {
            method: 'PUT',
            body: JSON.stringify({ chats }),
          });
          setMsg('chats-msg', 'Saved ' + chats.length + ' monitored chat(s). Check your G2 glasses!', 'ok');
        } catch (err) {
          setMsg('chats-msg', err.message, 'err');
        }
      });
    </script>
  </body>
</html>`;
    return reply.type('text/html; charset=utf-8').send(html);
  });
}
