import type { FastifyInstance } from 'fastify';

export default async function buildingRoutes(fastify: FastifyInstance) {
  // GET /api/v1/zones/:zone/streets/:street/buildings - paginated buildings with coordinates
  fastify.get<{
    Params: { zone: string; street: string };
    Querystring: { page?: string; limit?: string };
  }>('/api/v1/zones/:zone/streets/:street/buildings', async (request, reply) => {
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

    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(request.query.limit || '50', 10) || 50));
    const offset = (page - 1) * limit;

    try {
      // Verify zone and street exist
      const streetResult = await fastify.pg.query(
        `SELECT s.id FROM streets s
         JOIN zones z ON z.id = s.zone_id
         WHERE z.zone_number = $1 AND s.street_number = $2
           AND z.is_active = true AND s.is_active = true`,
        [zoneNumber, streetNumber]
      );

      if (streetResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: `Street ${streetNumber} in zone ${zoneNumber} not found` },
        });
      }

      const streetId = streetResult.rows[0].id;

      const [countResult, dataResult] = await Promise.all([
        fastify.pg.query(
          'SELECT COUNT(*)::int AS total FROM buildings WHERE street_id = $1',
          [streetId]
        ),
        fastify.pg.query(
          `SELECT building_number, latitude, longitude, source, verified
           FROM buildings WHERE street_id = $1
           ORDER BY building_number
           LIMIT $2 OFFSET $3`,
          [streetId, limit, offset]
        ),
      ]);

      const total = countResult.rows[0].total;
      const data = dataResult.rows.map((row: { building_number: number; latitude: number; longitude: number; source: string; verified: boolean }) => ({
        building_number: row.building_number,
        coordinates: { lat: row.latitude, lng: row.longitude },
        source: row.source,
        verified: row.verified,
      }));

      return reply.send({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total,
          has_more: offset + limit < total,
        },
      });
    } catch (err) {
      request.log.error(err, 'Failed to fetch buildings');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to fetch buildings' },
      });
    }
  });
}
