import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';

const MAX_PCM_BYTES = 640_000; // ~20 seconds at 16 kHz, 16-bit mono

export function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    parts.push(String.fromCharCode(...slice));
  }
  return btoa(parts.join(''));
}

export class G2AudioRecorder {
  private readonly bridge: EvenAppBridge;
  private chunks: Uint8Array[] = [];
  private totalBytes = 0;
  private active = false;

  constructor(bridge: EvenAppBridge) {
    this.bridge = bridge;
  }

  isActive(): boolean {
    return this.active;
  }

  async start(): Promise<boolean> {
    this.chunks = [];
    this.totalBytes = 0;
    this.active = true;
    try {
      const started = await this.bridge.audioControl(true);
      return Boolean(started);
    } catch {
      return false;
    }
  }

  pushPcmFrame(frame: Uint8Array): void {
    if (!this.active || frame.byteLength === 0) return;
    if (this.totalBytes + frame.byteLength > MAX_PCM_BYTES) return;
    this.chunks.push(frame);
    this.totalBytes += frame.byteLength;
  }

  async stop(): Promise<Uint8Array> {
    this.active = false;
    await this.bridge.audioControl(false).catch(() => false);

    const out = new Uint8Array(this.totalBytes);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    this.chunks = [];
    this.totalBytes = 0;
    return out;
  }

  async cancel(): Promise<void> {
    this.active = false;
    this.chunks = [];
    this.totalBytes = 0;
    await this.bridge.audioControl(false).catch(() => false);
  }
}
