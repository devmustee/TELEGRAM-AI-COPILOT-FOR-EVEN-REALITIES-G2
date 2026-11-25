import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env if present, then local .env
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173'),
  DATABASE_URL: z
    .string()
    .default('postgres://postgres:postgres@localhost:5432/telegram_ai_copilot'),
  SESSION_ENCRYPTION_KEY: z
    .string()
    .default('dev_only_replace_in_production_with_64_hex_chars_for_aes_gcm_key'),
  PAIRING_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  TELEGRAM_API_ID: z.string().optional().default(''),
  TELEGRAM_API_HASH: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_STT_MODEL: z.string().default('whisper-1'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  allowedOriginsList: parsed.data.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
