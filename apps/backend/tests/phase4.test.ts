import assert from 'node:assert/strict';
import test from 'node:test';
import { buildServer } from '../src/index.js';
import { pool } from '../src/db/pool.js';
import {
  decryptSecret,
  encryptSecret,
  generatePairingCode,
  hashToken,
  maskPhone,
} from '../src/security/crypto.js';
import { buildDeterministicDigest, scoreMessage } from '../src/services/prioritizer.js';

test('AES-256-GCM encryptSecret / decryptSecret roundtrip', () => {
  const secret = '1BVtsOHIBu_example_telegram_session_string_12345';
  const enc = encryptSecret(secret);
  assert.notEqual(enc.ciphertext, secret);
  assert.equal(decryptSecret(enc.ciphertext, enc.iv, enc.tag), secret);
  assert.equal(generatePairingCode(6).length, 6);
  assert.equal(hashToken('abc').length, 64);
  assert.equal(maskPhone('+15551234567'), '+1******4567');
});

test('scoreMessage prioritizes questions and urgent keywords over info', () => {
  const urgent = scoreMessage({
    id: '1',
    chatId: 'c1',
    chatTitle: 'Work Group',
    sender: 'John',
    text: 'URGENT: Can you confirm the deadline today?',
    receivedAt: new Date(),
    priorityWeight: 2,
    isOutgoing: false,
  });

  const info = scoreMessage({
    id: '2',
    chatId: 'c1',
    chatTitle: 'Work Group',
    sender: 'Alex',
    text: 'Good morning team',
    receivedAt: new Date(Date.now() - 10 * 60 * 60_000),
    priorityWeight: 1,
    isOutgoing: false,
  });

  assert.equal(urgent.urgency, 'urgent');
  assert.equal(urgent.needsReply, true);
  assert.ok(urgent.importanceScore > info.importanceScore);

  const digest = buildDeterministicDigest([urgent, info]);
  assert.equal(digest.unreadCount, 2);
  assert.equal(digest.actionCount, 1);
});

test('pairing, auth, chat allowlist, and confirmed-send guardrails work end to end', async () => {
  const app = await buildServer();
  try {
    // 1. Initialize pairing from G2 device
    const initRes = await app.inject({
      method: 'POST',
      url: '/api/pair/init',
      payload: { deviceLabel: 'G2 Test' },
    });
    assert.equal(initRes.statusCode, 201);
    const initBody = initRes.json() as {
      ok: boolean;
      code: string;
      sessionToken: string;
    };
    assert.equal(initBody.ok, true);
    assert.equal(initBody.code.length, 6);

    // 2. Status is pending before claim
    const pendingRes = await app.inject({
      method: 'GET',
      url: '/api/pair/status',
      headers: { authorization: `Bearer ${initBody.sessionToken}` },
    });
    assert.equal(pendingRes.statusCode, 200);
    assert.equal(pendingRes.json().paired, false);

    // 3. Companion browser claims pairing code
    const claimRes = await app.inject({
      method: 'POST',
      url: '/api/pair/claim',
      payload: { code: initBody.code },
    });
    assert.equal(claimRes.statusCode, 200);
    const claimBody = claimRes.json() as { ok: boolean; setupToken: string };
    assert.equal(claimBody.ok, true);
    assert.ok(claimBody.setupToken);

    // 4. Device status is now paired
    const pairedRes = await app.inject({
      method: 'GET',
      url: '/api/pair/status',
      headers: { authorization: `Bearer ${initBody.sessionToken}` },
    });
    assert.equal(pairedRes.statusCode, 200);
    assert.equal(pairedRes.json().paired, true);

    // 5. Save monitored chat allowlist
    const putChats = await app.inject({
      method: 'PUT',
      url: '/api/chats',
      headers: { authorization: `Bearer ${claimBody.setupToken}` },
      payload: {
        chats: [
          {
            telegramChatId: '-100123456',
            title: 'Work Group',
            chatType: 'group',
            priorityWeight: 3,
            enabled: true,
          },
        ],
      },
    });
    assert.equal(putChats.statusCode, 200);
    assert.equal(putChats.json().count, 1);

    const getChats = await app.inject({
      method: 'GET',
      url: '/api/chats',
      headers: { authorization: `Bearer ${initBody.sessionToken}` },
    });
    assert.equal(getChats.statusCode, 200);
    assert.equal(getChats.json().chats[0].title, 'Work Group');

    // 6. Send without confirmed=true is rejected
    const unconfirmed = await app.inject({
      method: 'POST',
      url: '/api/messages/send',
      headers: { authorization: `Bearer ${initBody.sessionToken}` },
      payload: {
        chatId: '-100123456',
        text: 'Hello',
        confirmed: false,
      },
    });
    assert.equal(unconfirmed.statusCode, 400);

    // 7. Send to chat outside monitored allowlist is forbidden (403)
    const forbidden = await app.inject({
      method: 'POST',
      url: '/api/messages/send',
      headers: { authorization: `Bearer ${initBody.sessionToken}` },
      payload: {
        chatId: '-100999999',
        text: 'Hello',
        confirmed: true,
      },
    });
    assert.equal(forbidden.statusCode, 403);
  } finally {
    await app.close();
  }
});

test.after(async () => {
  await pool.end();
});
