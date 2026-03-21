import type { FastifyInstance } from 'fastify';

export default async function healthRoutes(fastify: FastifyInstance) {
  // GET /api/v1/health
  fastify.get('/api/v1/health', async (request, reply) => {
    const startTime = process.hrtime.bigint();
    let dbOk = false;
    let redisOk = false;

    // Check database
    try {
      await fastify.pg.query('SELECT 1');
      dbOk = true;
    } catch {
      dbOk = false;
    }

    // Check redis
    try {
      if (fastify.redis) {
        await fastify.redis.ping();
        redisOk = true;
      }
    } catch {
      redisOk = false;
    }

    let status: 'ok' | 'degraded' | 'down';
    if (dbOk && redisOk) {
      status = 'ok';
    } else if (dbOk) {
      status = 'degraded';
    } else {
      status = 'down';
    }

    const uptimeSeconds = Math.floor(process.uptime());
    const statusCode = status === 'down' ? 503 : 200;

    return reply.status(statusCode).send({
      success: true,
      data: {
        status,
        database: dbOk,
        redis: redisOk,
        uptime_seconds: uptimeSeconds,
      },
    });
  });

  // GET /api/v1/stats
  fastify.get('/api/v1/stats', async (request, reply) => {
    try {
      const [zonesResult, streetsResult, buildingsResult, contributionsResult, crawlResult] = await Promise.all([
        fastify.pg.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active FROM zones'),
        fastify.pg.query('SELECT COUNT(*)::int AS total FROM streets'),
        fastify.pg.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE verified)::int AS verified FROM buildings'),
        fastify.pg.query(`
          SELECT
            COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
            COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
            COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
          FROM contributions
        `),
        fastify.pg.query('SELECT MAX(finished_at) AS last_crawl FROM crawl_log'),
      ]);

      return reply.send({
        success: true,
        data: {
          zones: zonesResult.rows[0],
          streets: streetsResult.rows[0],
          buildings: buildingsResult.rows[0],
          contributions: contributionsResult.rows[0],
          last_crawl: crawlResult.rows[0]?.last_crawl || null,
        },
      });
    } catch (err) {
      request.log.error(err, 'Failed to fetch stats');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to fetch stats' },
      });
    }
  });
}
