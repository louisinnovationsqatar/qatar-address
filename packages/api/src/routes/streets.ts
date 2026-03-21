import type { FastifyInstance } from 'fastify';

export default async function streetRoutes(fastify: FastifyInstance) {
  // GET /api/v1/zones/:zone/streets - paginated streets in a zone
  fastify.get<{
    Params: { zone: string };
    Querystring: { page?: string; limit?: string };
  }>('/api/v1/zones/:zone/streets', async (request, reply) => {
    const zoneNumber = parseInt(request.params.zone, 10);

    if (isNaN(zoneNumber) || zoneNumber < 1 || zoneNumber > 98) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Zone must be a number between 1 and 98' },
      });
    }

    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(request.query.limit || '50', 10) || 50));
    const offset = (page - 1) * limit;

    try {
      // Verify zone exists
      const zoneResult = await fastify.pg.query(
        'SELECT id FROM zones WHERE zone_number = $1 AND is_active = true',
        [zoneNumber]
      );

      if (zoneResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: `Zone ${zoneNumber} not found` },
        });
      }

      const zoneId = zoneResult.rows[0].id;

      const [countResult, dataResult] = await Promise.all([
        fastify.pg.query(
          'SELECT COUNT(*)::int AS total FROM streets WHERE zone_id = $1 AND is_active = true',
          [zoneId]
        ),
        fastify.pg.query(
          `SELECT street_number, street_name, street_name_ar
           FROM streets WHERE zone_id = $1 AND is_active = true
           ORDER BY street_number
           LIMIT $2 OFFSET $3`,
          [zoneId, limit, offset]
        ),
      ]);

      const total = countResult.rows[0].total;

      return reply.send({
        success: true,
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          has_more: offset + limit < total,
        },
      });
    } catch (err) {
      request.log.error(err, 'Failed to fetch streets');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to fetch streets' },
      });
    }
  });

  // GET /api/v1/zones/:zone/streets/:street - single street with geometry
  fastify.get<{
    Params: { zone: string; street: string };
  }>('/api/v1/zones/:zone/streets/:street', async (request, reply) => {
    const zoneNumber = parseInt(request.params.zone, 10);
    const streetNumber = parseInt(request.params.street, 10);

    if (isNaN(zoneNumber) || zoneNumber < 1 || zoneNumber > 98) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Zone must be a number between 1 and 98' },
      });
    }

    if (isNaN(streetNumber) || streetNumber < 1) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Street must be a positive number' },
      });
    }

    try {
      const result = await fastify.pg.query(
        `SELECT s.street_number, s.street_name, s.street_name_ar,
                ST_AsGeoJSON(s.geometry)::json AS geometry
         FROM streets s
         JOIN zones z ON z.id = s.zone_id
         WHERE z.zone_number = $1 AND s.street_number = $2
           AND z.is_active = true AND s.is_active = true`,
        [zoneNumber, streetNumber]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: `Street ${streetNumber} in zone ${zoneNumber} not found` },
        });
      }

      return reply.send({
        success: true,
        data: result.rows[0],
      });
    } catch (err) {
      request.log.error(err, 'Failed to fetch street');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to fetch street' },
      });
    }
  });
}
