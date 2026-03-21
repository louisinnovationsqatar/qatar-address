import Fastify from 'fastify';
import databasePlugin from './plugins/database.js';
import redisPlugin from './plugins/redis.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import corsPlugin from './plugins/cors.js';
import healthRoutes from './routes/health.js';
import zoneRoutes from './routes/zones.js';
import streetRoutes from './routes/streets.js';
import buildingRoutes from './routes/buildings.js';
import locateRoutes from './routes/locate.js';
import searchRoutes from './routes/search.js';
import reverseRoutes from './routes/reverse.js';
import validateRoutes from './routes/validate.js';
import contributeRoutes from './routes/contribute.js';
import adminRoutes from './routes/admin.js';

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Register plugins
  await fastify.register(corsPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(databasePlugin);
  await fastify.register(redisPlugin);

  // Register public routes
  await fastify.register(healthRoutes);
  await fastify.register(zoneRoutes);
  await fastify.register(streetRoutes);
  await fastify.register(buildingRoutes);
  await fastify.register(locateRoutes);
  await fastify.register(searchRoutes);
  await fastify.register(reverseRoutes);
  await fastify.register(validateRoutes);
  await fastify.register(contributeRoutes);

  // Register admin routes with prefix
  await fastify.register(adminRoutes, { prefix: '/admin' });

  return fastify;
}
