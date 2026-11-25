import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { registerAiRoutes } from './routes/ai.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerMessageRoutes } from './routes/messages.js';
import { registerPairingRoutes } from './routes/pairing.js';
import { registerSetupRoutes } from './routes/setup.js';
import { registerTelegramRoutes } from './routes/telegram.js';
import { registerVoiceRoutes } from './routes/voice.js';

export async function buildServer() {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  await app.register(cors, {
    origin: env.allowedOriginsList,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  await registerHealthRoutes(app);
  await registerSetupRoutes(app);
  await registerPairingRoutes(app);
  await registerTelegramRoutes(app);
  await registerMessageRoutes(app);
  await registerAiRoutes(app);
  await registerVoiceRoutes(app);

  return app;
}

async function start() {
  const app = await buildServer();

  const shutdown = async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ port: env.PORT, host: env.HOST });
}

const isEntrypoint =
  process.argv[1] &&
  (process.argv[1].endsWith('/index.ts') || process.argv[1].endsWith('/index.js'));

if (isEntrypoint) {
  start().catch((err) => {
    console.error('Backend failed to start:', err);
    process.exit(1);
  });
}
