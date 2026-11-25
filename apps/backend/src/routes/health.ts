import type { FastifyInstance } from 'fastify';
import { checkDatabaseHealth } from '../db/pool.js';
import { env } from '../config/env.js';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (_request, reply) => {
    const db = await checkDatabaseHealth();
    return reply.status(200).send({
      ok: true,
      service: 'telegram-ai-copilot-backend',
      db,
      features: {
        telegramConfigured: Boolean(env.TELEGRAM_API_ID && env.TELEGRAM_API_HASH),
        openAiConfigured: Boolean(env.OPENAI_API_KEY),
      },
      timestamp: new Date().toISOString(),
    });
  });
}
