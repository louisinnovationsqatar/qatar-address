import fp from 'fastify-plugin';
import Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  let redis: Redis | null = null;
  try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    await redis.connect();
    fastify.log.info('Redis connected');
  } catch {
    fastify.log.warn('Redis unavailable - running without cache');
    redis = null;
  }
  fastify.decorate('redis', redis);
  fastify.addHook('onClose', async () => { if (redis) await redis.quit(); });
}, { name: 'redis' });
