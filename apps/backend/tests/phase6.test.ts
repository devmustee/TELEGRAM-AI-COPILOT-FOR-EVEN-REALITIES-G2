import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../src/db/pool.js';
import { buildServer } from '../src/index.js';
import { VoiceService, encodePcm16kMonoToWav } from '../src/services/voiceService.js';

test('encodePcm16kMonoToWav writes valid 44-byte RIFF/WAVE 16kHz mono PCM header', () => {
  const pcm = Buffer.alloc(3200, 1); // 100ms at 16kHz 16-bit mono
  const wav = encodePcm16kMonoToWav(pcm);

  assert.equal(wav.length, 44 + 3200);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(4), 36 + 3200);
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.toString('ascii', 12, 16), 'fmt ');
  assert.equal(wav.readUInt16LE(20), 1); // Linear PCM
  assert.equal(wav.readUInt16LE(22), 1); // Mono
  assert.equal(wav.readUInt32LE(24), 16000); // Sample rate
  assert.equal(wav.readUInt32LE(28), 32000); // Byte rate
  assert.equal(wav.readUInt16LE(32), 2); // Block align
  assert.equal(wav.readUInt16LE(34), 16); // Bits per sample
  assert.equal(wav.toString('ascii', 36, 40), 'data');
  assert.equal(wav.readUInt32LE(40), 3200);
});

test('VoiceService rejects too-short audio and returns trimmed transcript from STT', async () => {
  const service = new VoiceService(() => ({
    async transcribeWav(wav) {
      assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
      return '  Summarize my work group  ';
    },
  }));

  await assert.rejects(
    () => service.transcribePcm(Buffer.alloc(100)),
    /Recording was too short/,
  );

  const text = await service.transcribePcm(Buffer.alloc(8000, 2));
  assert.equal(text, 'Summarize my work group');
});

test('POST /api/voice/command enforces auth and payload validation', async () => {
  const app = await buildServer();
  try {
    const unauth = await app.inject({
      method: 'POST',
      url: '/api/voice/command',
      payload: { transcript: 'What did I miss?' },
    });
    assert.equal(unauth.statusCode, 401);

    const pairRes = await app.inject({ method: 'POST', url: '/api/pair/init' });
    const { code, sessionToken } = pairRes.json() as { code: string; sessionToken: string };
    await app.inject({ method: 'POST', url: '/api/pair/claim', payload: { code } });

    const invalidPayload = await app.inject({
      method: 'POST',
      url: '/api/voice/command',
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: { mode: 'command' },
    });
    assert.equal(invalidPayload.statusCode, 400);

    const tooShortPcm = await app.inject({
      method: 'POST',
      url: '/api/voice/command',
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: { pcmBase64: Buffer.alloc(64).toString('base64'), mode: 'command' },
    });
    assert.equal(tooShortPcm.statusCode, 400);
    assert.equal(tooShortPcm.json().error, 'AUDIO_TOO_SHORT');
  } finally {
    await app.close();
  }
});

test.after(async () => {
  await pool.end();
});
