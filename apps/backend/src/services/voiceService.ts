import OpenAI, { toFile } from 'openai';
import { env } from '../config/env.js';
import { AiServiceError } from './aiService.js';

const SAMPLE_RATE = 16_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const MIN_PCM_BYTES = 4_000; // ~0.125s at 16 kHz mono 16-bit

export interface SttRunner {
  transcribeWav(wavBuffer: Buffer): Promise<string>;
}

/**
 * Prepends a standard 44-byte RIFF/WAVE header to raw 16 kHz, 16-bit signed LE mono PCM.
 */
export function encodePcm16kMonoToWav(pcm: Uint8Array | Buffer): Buffer {
  const pcmBuf = Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const dataSize = pcmBuf.length;
  const header = Buffer.alloc(44);
  const byteRate = (SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE) / 8;
  const blockAlign = (CHANNELS * BITS_PER_SAMPLE) / 8;

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // Linear PCM
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuf]);
}

function createWhisperRunner(): SttRunner {
  const apiKey = env.OPENAI_API_KEY.trim();
  if (!apiKey) {
    throw new AiServiceError(
      'OPENAI_NOT_CONFIGURED',
      'OPENAI_API_KEY is required for speech-to-text transcription.',
      503,
    );
  }
  const client = new OpenAI({ apiKey });

  return {
    async transcribeWav(wavBuffer: Buffer): Promise<string> {
      try {
        const file = await toFile(wavBuffer, 'g2-voice.wav', { type: 'audio/wav' });
        const result = await client.audio.transcriptions.create({
          file,
          model: env.OPENAI_STT_MODEL,
        });
        return (result.text || '').trim();
      } catch (err) {
        if (err instanceof AiServiceError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new AiServiceError('STT_UPSTREAM_ERROR', `Speech-to-text failed: ${msg}`, 502);
      }
    },
  };
}

export class VoiceService {
  private readonly runnerFactory: () => SttRunner;

  constructor(runnerFactory: () => SttRunner = createWhisperRunner) {
    this.runnerFactory = runnerFactory;
  }

  async transcribePcm(pcm: Buffer): Promise<string> {
    if (pcm.length < MIN_PCM_BYTES) {
      throw new AiServiceError(
        'AUDIO_TOO_SHORT',
        'Recording was too short or silent. Hold longer and speak clearly.',
        400,
      );
    }
    const wav = encodePcm16kMonoToWav(pcm);
    const runner = this.runnerFactory();
    const transcript = (await runner.transcribeWav(wav)).trim();
    if (!transcript) {
      throw new AiServiceError(
        'EMPTY_TRANSCRIPT',
        'Could not understand speech. Please try again.',
        400,
      );
    }
    return transcript;
  }
}

export const voiceService = new VoiceService();
