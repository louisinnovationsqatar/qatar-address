import type { FastifyInstance } from 'fastify';

export default async function locateRoutes(fastify: FastifyInstance) {
  // GET /api/v1/locate/:zone/:street/:building - full locate response
  fastify.get<{
    Params: { zone: string; street: string; building: string };
  }>('/api/v1/locate/:zone/:street/:building', async (request, reply) => {
    const zoneNumber = parseInt(request.params.zone, 10);
    const streetNumber = parseInt(request.params.street, 10);
    const buildingNumber = parseInt(request.params.building, 10);

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

    if (isNaN(buildingNumber) || buildingNumber < 1) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Building must be a positive number' },
      });
    }

    const cacheKey = `locate:${zoneNumber}:${streetNumber}:${buildingNumber}`;

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
      const result = await fastify.pg.query(
        `SELECT
           z.zone_number, z.zone_name, z.zone_name_ar,
           s.street_number, s.street_name, s.street_name_ar,
           b.building_number, b.latitude, b.longitude,
           b.source, b.verified
         FROM buildings b
         JOIN streets s ON s.id = b.street_id
         JOIN zones z ON z.id = s.zone_id
         WHERE z.zone_number = $1 AND s.street_number = $2 AND b.building_number = $3
           AND z.is_active = true AND s.is_active = true`,
        [zoneNumber, streetNumber, buildingNumber]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: `Address ${zoneNumber}/${streetNumber}/${buildingNumber} not found` },
        });
      }

      const row = result.rows[0];
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);

      const fullAddress = [
        `Building ${row.building_number}`,
        row.street_name ? `${row.street_name} (Street ${row.street_number})` : `Street ${row.street_number}`,
        row.zone_name ? `${row.zone_name} (Zone ${row.zone_number})` : `Zone ${row.zone_number}`,
        'Qatar',
      ].join(', ');

      const fullAddressAr = [
        `\u0645\u0628\u0646\u0649 ${row.building_number}`,
        row.street_name_ar ? `${row.street_name_ar} (\u0634\u0627\u0631\u0639 ${row.street_number})` : `\u0634\u0627\u0631\u0639 ${row.street_number}`,
        row.zone_name_ar ? `${row.zone_name_ar} (\u0645\u0646\u0637\u0642\u0629 ${row.zone_number})` : `\u0645\u0646\u0637\u0642\u0629 ${row.zone_number}`,
        '\u0642\u0637\u0631',
      ].join('\u060C ');

      const response = {
        success: true as const,
        data: {
          zone: { number: row.zone_number, name: row.zone_name, name_ar: row.zone_name_ar },
          street: { number: row.street_number, name: row.street_name, name_ar: row.street_name_ar },
          building: { number: row.building_number },
          coordinates: { lat, lng },
          links: {
            google_maps: `https://www.google.com/maps?q=${lat},${lng}`,
            waze: `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`,
          },
          source: row.source,
          verified: row.verified,
          full_address: fullAddress,
          full_address_ar: fullAddressAr,
        },
      };

      // Cache for 24 hours
      if (fastify.redis) {
        try {
          await fastify.redis.set(cacheKey, JSON.stringify(response), 'EX', 86400);
        } catch {
          // Cache write failure is non-fatal
        }
      }

      return reply.send(response);
    } catch (err) {
      request.log.error(err, 'Failed to locate address');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to locate address' },
      });
    }
  });
}
