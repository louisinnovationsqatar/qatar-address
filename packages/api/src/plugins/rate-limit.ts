import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    addHeadersOnExceeding: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true, 'x-ratelimit-reset': true },
    addHeaders: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true, 'x-ratelimit-reset': true, 'retry-after': true },
    errorResponseBuilder: () => ({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
    }),
  });
}, { name: 'rate-limit' });
