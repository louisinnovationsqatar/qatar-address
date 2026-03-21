import type { FastifyInstance } from 'fastify';

export default async function contributeRoutes(fastify: FastifyInstance) {
  // POST /api/v1/contribute - submit a community contribution
  fastify.post<{
    Body: {
      zone_number: number;
      street_number: number;
      building_number: number;
      latitude?: number;
      longitude?: number;
      contributor_name: string;
      contributor_email: string;
      notes?: string;
    };
  }>('/api/v1/contribute', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const body = request.body;

    if (!body || typeof body !== 'object') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Request body is required' },
      });
    }

    const { zone_number, street_number, building_number, latitude, longitude, contributor_name, contributor_email, notes } = body;

    // Validate required fields
    if (!zone_number || !street_number || !building_number) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'zone_number, street_number, and building_number are required' },
      });
    }

    if (!contributor_name || typeof contributor_name !== 'string' || contributor_name.trim().length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'contributor_name is required' },
      });
    }

    if (!contributor_email || typeof contributor_email !== 'string' || !contributor_email.includes('@')) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'A valid contributor_email is required' },
      });
    }

    if (typeof zone_number !== 'number' || zone_number < 1 || zone_number > 98) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'zone_number must be between 1 and 98' },
      });
    }

    if (typeof street_number !== 'number' || street_number < 1) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'street_number must be a positive number' },
      });
    }

    if (typeof building_number !== 'number' || building_number < 1) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'building_number must be a positive number' },
      });
    }

    if (latitude !== undefined && (typeof latitude !== 'number' || latitude < -90 || latitude > 90)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'latitude must be a number between -90 and 90' },
      });
    }

    if (longitude !== undefined && (typeof longitude !== 'number' || longitude < -180 || longitude > 180)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'longitude must be a number between -180 and 180' },
      });
    }

    try {
      // 24-hour duplicate check
      const dupeResult = await fastify.pg.query(
        `SELECT id FROM contributions
         WHERE zone_number = $1 AND street_number = $2 AND building_number = $3
           AND contributor_email = $4
           AND created_at > NOW() - INTERVAL '24 hours'`,
        [zone_number, street_number, building_number, contributor_email.trim()]
      );

      if (dupeResult.rows.length > 0) {
        return reply.status(409).send({
          success: false,
          error: { code: 'DUPLICATE_CONTRIBUTION', message: 'A contribution for this address was already submitted in the last 24 hours' },
        });
      }

      // Insert contribution
      const result = await fastify.pg.query(
        `INSERT INTO contributions (zone_number, street_number, building_number, latitude, longitude, contributor_name, contributor_email, notes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
         RETURNING id, status, created_at`,
        [zone_number, street_number, building_number, latitude || null, longitude || null, contributor_name.trim(), contributor_email.trim(), notes?.trim() || null]
      );

      return reply.status(201).send({
        success: true,
        data: {
          id: result.rows[0].id,
          status: result.rows[0].status,
          created_at: result.rows[0].created_at,
        },
      });
    } catch (err) {
      request.log.error(err, 'Failed to submit contribution');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to submit contribution' },
      });
    }
  });

  // GET /api/v1/contributions/:id/status - check contribution status
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/contributions/:id/status', async (request, reply) => {
    const id = parseInt(request.params.id, 10);

    if (isNaN(id) || id < 1) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Contribution ID must be a positive number' },
      });
    }

    try {
      const result = await fastify.pg.query(
        'SELECT id, status, reviewed_by, reviewed_at, created_at FROM contributions WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: `Contribution ${id} not found` },
        });
      }

      return reply.send({
        success: true,
        data: result.rows[0],
      });
    } catch (err) {
      request.log.error(err, 'Failed to fetch contribution status');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to fetch contribution status' },
      });
    }
  });
}
