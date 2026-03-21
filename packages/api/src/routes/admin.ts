import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { spawn } from 'child_process';

async function adminAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  const apiKey = process.env.ADMIN_API_KEY;

  if (!apiKey) {
    return reply.status(500).send({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Admin API key not configured' },
    });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== apiKey) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or missing admin API key' },
    });
  }
}

export default async function adminRoutes(fastify: FastifyInstance) {
  // Auth hook for all routes in this plugin
  fastify.addHook('onRequest', adminAuth);

  // GET /contributions - paginated list by status
  fastify.get<{
    Querystring: { status?: string; page?: string; limit?: string };
  }>('/contributions', async (request, reply) => {
    const status = request.query.status; // pending | approved | rejected
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(request.query.limit || '50', 10) || 50));
    const offset = (page - 1) * limit;

    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Status must be "pending", "approved", or "rejected"' },
      });
    }

    try {
      const whereClause = status ? 'WHERE status = $1' : '';
      const params = status ? [status, limit, offset] : [limit, offset];
      const countParams = status ? [status] : [];

      const [countResult, dataResult] = await Promise.all([
        fastify.pg.query(
          `SELECT COUNT(*)::int AS total FROM contributions ${whereClause}`,
          countParams
        ),
        fastify.pg.query(
          `SELECT id, zone_number, street_number, building_number, latitude, longitude,
                  contributor_name, contributor_email, status, notes, reviewed_by, reviewed_at, created_at
           FROM contributions ${whereClause}
           ORDER BY created_at DESC
           LIMIT $${status ? 2 : 1} OFFSET $${status ? 3 : 2}`,
          params
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
      request.log.error(err, 'Failed to fetch contributions');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to fetch contributions' },
      });
    }
  });

  // PUT /contributions/:id - approve or reject a contribution
  fastify.put<{
    Params: { id: string };
    Body: { status: string; reviewed_by?: string };
  }>('/contributions/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    const body = request.body;

    if (isNaN(id) || id < 1) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Contribution ID must be a positive number' },
      });
    }

    if (!body || !body.status || !['approved', 'rejected'].includes(body.status)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'status must be "approved" or "rejected"' },
      });
    }

    const client = await fastify.pg.connect();

    try {
      await client.query('BEGIN');

      // Fetch the contribution
      const contribResult = await client.query(
        'SELECT * FROM contributions WHERE id = $1',
        [id]
      );

      if (contribResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: `Contribution ${id} not found` },
        });
      }

      const contrib = contribResult.rows[0];

      // Update contribution status
      await client.query(
        `UPDATE contributions SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`,
        [body.status, body.reviewed_by || 'admin', id]
      );

      // If approved, insert into main tables
      if (body.status === 'approved') {
        // Ensure zone exists
        let zoneResult = await client.query(
          'SELECT id FROM zones WHERE zone_number = $1',
          [contrib.zone_number]
        );

        let zoneId: number;
        if (zoneResult.rows.length === 0) {
          const insertZone = await client.query(
            `INSERT INTO zones (zone_number, source, is_active) VALUES ($1, 'COMMUNITY', true) RETURNING id`,
            [contrib.zone_number]
          );
          zoneId = insertZone.rows[0].id;
        } else {
          zoneId = zoneResult.rows[0].id;
        }

        // Ensure street exists
        let streetResult = await client.query(
          'SELECT id FROM streets WHERE zone_id = $1 AND street_number = $2',
          [zoneId, contrib.street_number]
        );

        let streetId: number;
        if (streetResult.rows.length === 0) {
          const insertStreet = await client.query(
            `INSERT INTO streets (zone_id, street_number, source, is_active) VALUES ($1, $2, 'COMMUNITY', true) RETURNING id`,
            [zoneId, contrib.street_number]
          );
          streetId = insertStreet.rows[0].id;
        } else {
          streetId = streetResult.rows[0].id;
        }

        // Insert or update building
        const existingBuilding = await client.query(
          'SELECT id FROM buildings WHERE street_id = $1 AND building_number = $2',
          [streetId, contrib.building_number]
        );

        if (existingBuilding.rows.length === 0) {
          await client.query(
            `INSERT INTO buildings (street_id, building_number, latitude, longitude, source, verified)
             VALUES ($1, $2, $3, $4, 'COMMUNITY', true)`,
            [streetId, contrib.building_number, contrib.latitude, contrib.longitude]
          );
        } else {
          await client.query(
            `UPDATE buildings SET latitude = COALESCE($1, latitude), longitude = COALESCE($2, longitude),
                    source = 'COMMUNITY', verified = true, verified_at = NOW()
             WHERE id = $3`,
            [contrib.latitude, contrib.longitude, existingBuilding.rows[0].id]
          );
        }
      }

      await client.query('COMMIT');

      return reply.send({
        success: true,
        data: { id, status: body.status, reviewed_by: body.reviewed_by || 'admin' },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      request.log.error(err, 'Failed to update contribution');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to update contribution' },
      });
    } finally {
      client.release();
    }
  });

  // POST /crawl/start - spawn crawler process
  fastify.post('/crawl/start', async (request, reply) => {
    try {
      const child = spawn('node', ['../crawler/dist/index.js'], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
      });
      child.unref();

      // Log the crawl start
      await fastify.pg.query(
        `INSERT INTO crawl_log (started_at, status) VALUES (NOW(), 'running')`
      );

      return reply.status(202).send({
        success: true,
        data: { message: 'Crawler started', pid: child.pid },
      });
    } catch (err) {
      request.log.error(err, 'Failed to start crawler');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to start crawler' },
      });
    }
  });

  // GET /crawl/status - crawl log summary
  fastify.get('/crawl/status', async (request, reply) => {
    try {
      const result = await fastify.pg.query(
        `SELECT id, started_at, finished_at, status, zones_crawled, streets_crawled, buildings_crawled, error_message
         FROM crawl_log
         ORDER BY started_at DESC
         LIMIT 10`
      );

      return reply.send({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      request.log.error(err, 'Failed to fetch crawl status');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to fetch crawl status' },
      });
    }
  });

  // GET /stats - detailed DB metrics
  fastify.get('/stats', async (request, reply) => {
    try {
      const [zonesResult, streetsResult, buildingsResult, contributionsResult, crawlResult, dbSizeResult] = await Promise.all([
        fastify.pg.query(`
          SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active,
                 COUNT(DISTINCT municipality) FILTER (WHERE municipality IS NOT NULL)::int AS municipalities
          FROM zones
        `),
        fastify.pg.query(`
          SELECT COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE street_name IS NOT NULL)::int AS named,
                 COUNT(*) FILTER (WHERE street_name_ar IS NOT NULL)::int AS named_ar
          FROM streets
        `),
        fastify.pg.query(`
          SELECT COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE verified)::int AS verified,
                 COUNT(DISTINCT source)::int AS sources
          FROM buildings
        `),
        fastify.pg.query(`
          SELECT COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                 COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
                 COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
          FROM contributions
        `),
        fastify.pg.query('SELECT MAX(finished_at) AS last_crawl FROM crawl_log'),
        fastify.pg.query("SELECT pg_size_pretty(pg_database_size(current_database())) AS size"),
      ]);

      return reply.send({
        success: true,
        data: {
          zones: zonesResult.rows[0],
          streets: streetsResult.rows[0],
          buildings: buildingsResult.rows[0],
          contributions: contributionsResult.rows[0],
          last_crawl: crawlResult.rows[0]?.last_crawl || null,
          database_size: dbSizeResult.rows[0]?.size || 'unknown',
        },
      });
    } catch (err) {
      request.log.error(err, 'Failed to fetch admin stats');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to fetch admin stats' },
      });
    }
  });
}
