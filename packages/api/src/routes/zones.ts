import type { FastifyInstance } from 'fastify';

export default async function zoneRoutes(fastify: FastifyInstance) {
  // GET /api/v1/zones - paginated list of zones
  fastify.get<{
    Querystring: { page?: string; limit?: string };
  }>('/api/v1/zones', async (request, reply) => {
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(request.query.limit || '50', 10) || 50));
    const offset = (page - 1) * limit;

    const cacheKey = `zones:page:${page}:limit:${limit}`;

    // Try cache
    if (fastify.redis) {
      try {
        const cached = await fastify.redis.get(cacheKey);
        if (cached) {
          return reply.send(JSON.parse(cached));
        }
      } catch {
        // Cache miss, continue to DB
      }
    }

    try {
      const [countResult, dataResult] = await Promise.all([
        fastify.pg.query('SELECT COUNT(*)::int AS total FROM zones WHERE is_active = true'),
        fastify.pg.query(
          `SELECT zone_number, zone_name, zone_name_ar, municipality, municipality_ar
           FROM zones WHERE is_active = true
           ORDER BY zone_number
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        ),
      ]);

      const total = countResult.rows[0].total;
      const response = {
        success: true as const,
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          has_more: offset + limit < total,
        },
      };

      // Cache for 1 hour
      if (fastify.redis) {
        try {
          await fastify.redis.set(cacheKey, JSON.stringify(response), 'EX', 3600);
        } catch {
          // Cache write failure is non-fatal
        }
      }

      return reply.send(response);
    } catch (err) {
      request.log.error(err, 'Failed to fetch zones');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to fetch zones' },
      });
    }
  });

  // GET /api/v1/zones/:zone - single zone with boundary polygon
  fastify.get<{
    Params: { zone: string };
  }>('/api/v1/zones/:zone', async (request, reply) => {
    const zoneNumber = parseInt(request.params.zone, 10);

    if (isNaN(zoneNumber) || zoneNumber < 1 || zoneNumber > 98) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Zone must be a number between 1 and 98' },
      });
    }

    try {
      const result = await fastify.pg.query(
        `SELECT zone_number, zone_name, zone_name_ar, municipality, municipality_ar,
                ST_AsGeoJSON(boundary)::json AS boundary
         FROM zones
         WHERE zone_number = $1 AND is_active = true`,
        [zoneNumber]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: `Zone ${zoneNumber} not found` },
        });
      }

      return reply.send({
        success: true,
        data: result.rows[0],
      });
    } catch (err) {
      request.log.error(err, 'Failed to fetch zone');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to fetch zone' },
      });
    }
  });
}
