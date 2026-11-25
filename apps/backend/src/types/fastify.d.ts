import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    authUserId?: string;
    authSessionKind?: 'device' | 'setup';
  }
}
