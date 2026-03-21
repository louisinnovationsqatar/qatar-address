import type { FastifyInstance } from 'fastify';

// Qatar bounding box
const QATAR_BBOX = {
  minLat: 24.4,
  maxLat: 26.3,
  minLng: 50.7,
  maxLng: 51.7,
};

export default async function reverseRoutes(fastify: FastifyInstance) {
  // GET /api/v1/reverse?lat=&lng=&radius= - PostGIS nearest building
  fastify.get<{
    Querystring: { lat?: string; lng?: string; radius?: string };
  }>('/api/v1/reverse', async (request, reply) => {
    const lat = parseFloat(request.query.lat || '');
    const lng = parseFloat(request.query.lng || '');
    const radius = Math.min(5000, Math.max(10, parseInt(request.query.radius || '500', 10) || 500));

    if (isNaN(lat) || isNaN(lng)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'lat and lng are required and must be valid numbers' },
      });
    }

    // Qatar bounding box check
    if (lat < QATAR_BBOX.minLat || lat > QATAR_BBOX.maxLat || lng < QATAR_BBOX.minLng || lng > QATAR_BBOX.maxLng) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Coordinates must be within Qatar bounding box' },
      });
    }

    try {
      const result = await fastify.pg.query(
        `SELECT
           z.zone_number, z.zone_name, z.zone_name_ar,
           s.street_number, s.street_name, s.street_name_ar,
           b.building_number, b.latitude, b.longitude,
           ST_Distance(
             ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
             ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
           ) AS distance_meters
         FROM buildings b
         JOIN streets s ON s.id = b.street_id
         JOIN zones z ON z.id = s.zone_id
         WHERE z.is_active = true AND s.is_active = true
           AND ST_DWithin(
             ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
             ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
             $3
           )
         ORDER BY distance_meters
         LIMIT 1`,
        [lat, lng, radius]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: `No building found within ${radius}m of the given coordinates` },
        });
      }

      const row = result.rows[0];
      const bLat = parseFloat(row.latitude);
      const bLng = parseFloat(row.longitude);

      return reply.send({
        success: true,
        data: {
          zone: { number: row.zone_number, name: row.zone_name, name_ar: row.zone_name_ar },
          street: { number: row.street_number, name: row.street_name, name_ar: row.street_name_ar },
          building: { number: row.building_number },
          coordinates: { lat: bLat, lng: bLng },
          distance_meters: Math.round(parseFloat(row.distance_meters) * 100) / 100,
          links: {
            google_maps: `https://www.google.com/maps?q=${bLat},${bLng}`,
            waze: `https://www.waze.com/ul?ll=${bLat},${bLng}&navigate=yes`,
          },
        },
      });
    } catch (err) {
      request.log.error(err, 'Failed to reverse geocode');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Reverse geocoding failed' },
      });
    }
  });
}
