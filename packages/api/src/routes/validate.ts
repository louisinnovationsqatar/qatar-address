import type { FastifyInstance } from 'fastify';

export default async function validateRoutes(fastify: FastifyInstance) {
  // GET /api/v1/validate?zone=&street=&building= - cascading existence check
  fastify.get<{
    Querystring: { zone?: string; street?: string; building?: string };
  }>('/api/v1/validate', async (request, reply) => {
    const zoneNumber = parseInt(request.query.zone || '', 10);

    if (isNaN(zoneNumber) || zoneNumber < 1) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'zone is required and must be a positive number' },
      });
    }

    const streetNumber = request.query.street ? parseInt(request.query.street, 10) : undefined;
    const buildingNumber = request.query.building ? parseInt(request.query.building, 10) : undefined;

    if (streetNumber !== undefined && (isNaN(streetNumber) || streetNumber < 1)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'street must be a positive number' },
      });
    }

    if (buildingNumber !== undefined && (isNaN(buildingNumber) || buildingNumber < 1)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'building must be a positive number' },
      });
    }

    try {
      let zoneExists = false;
      let streetExists = false;
      let buildingExists = false;

      // Check zone
      const zoneResult = await fastify.pg.query(
        'SELECT id FROM zones WHERE zone_number = $1 AND is_active = true',
        [zoneNumber]
      );
      zoneExists = zoneResult.rows.length > 0;

      // Check street (only if zone exists and street was provided)
      if (zoneExists && streetNumber !== undefined) {
        const streetResult = await fastify.pg.query(
          `SELECT s.id FROM streets s
           JOIN zones z ON z.id = s.zone_id
           WHERE z.zone_number = $1 AND s.street_number = $2
             AND z.is_active = true AND s.is_active = true`,
          [zoneNumber, streetNumber]
        );
        streetExists = streetResult.rows.length > 0;

        // Check building (only if street exists and building was provided)
        if (streetExists && buildingNumber !== undefined) {
          const buildingResult = await fastify.pg.query(
            `SELECT b.id FROM buildings b
             JOIN streets s ON s.id = b.street_id
             JOIN zones z ON z.id = s.zone_id
             WHERE z.zone_number = $1 AND s.street_number = $2 AND b.building_number = $3
               AND z.is_active = true AND s.is_active = true`,
            [zoneNumber, streetNumber, buildingNumber]
          );
          buildingExists = buildingResult.rows.length > 0;
        }
      }

      const valid = zoneExists
        && (streetNumber === undefined || streetExists)
        && (buildingNumber === undefined || buildingExists);

      return reply.send({
        success: true,
        data: {
          valid,
          zone_exists: zoneExists,
          street_exists: streetExists,
          building_exists: buildingExists,
        },
      });
    } catch (err) {
      request.log.error(err, 'Failed to validate address');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Validation failed' },
      });
    }
  });
}
