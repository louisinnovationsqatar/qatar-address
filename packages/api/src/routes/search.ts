import type { FastifyInstance } from 'fastify';

export default async function searchRoutes(fastify: FastifyInstance) {
  // GET /api/v1/search?q=&lang=&type= - trigram search on zone/street names
  fastify.get<{
    Querystring: { q?: string; lang?: string; type?: string; page?: string; limit?: string };
  }>('/api/v1/search', async (request, reply) => {
    const query = (request.query.q || '').trim();
    const lang = request.query.lang || 'en';
    const type = request.query.type; // 'zone' | 'street' | undefined (both)
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10) || 20));
    const offset = (page - 1) * limit;

    if (!query || query.length < 2) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Search query must be at least 2 characters' },
      });
    }

    if (lang !== 'en' && lang !== 'ar') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Language must be "en" or "ar"' },
      });
    }

    if (type && type !== 'zone' && type !== 'street') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Type must be "zone" or "street"' },
      });
    }

    try {
      const results: Array<{
        type: string;
        zone_number: number;
        zone_name: string | null;
        zone_name_ar: string | null;
        street_number?: number;
        street_name?: string | null;
        street_name_ar?: string | null;
        similarity: number;
      }> = [];

      const nameColumn = lang === 'ar' ? 'zone_name_ar' : 'zone_name';
      const streetNameColumn = lang === 'ar' ? 'street_name_ar' : 'street_name';

      // Search zones
      if (!type || type === 'zone') {
        const zoneResults = await fastify.pg.query(
          `SELECT 'zone' AS type, zone_number, zone_name, zone_name_ar,
                  similarity(${nameColumn}, $1) AS similarity
           FROM zones
           WHERE is_active = true AND ${nameColumn} % $1
           ORDER BY similarity DESC
           LIMIT $2 OFFSET $3`,
          [query, limit, offset]
        );
        results.push(...zoneResults.rows);
      }

      // Search streets
      if (!type || type === 'street') {
        const streetResults = await fastify.pg.query(
          `SELECT 'street' AS type, z.zone_number, z.zone_name, z.zone_name_ar,
                  s.street_number, s.street_name, s.street_name_ar,
                  similarity(s.${streetNameColumn}, $1) AS similarity
           FROM streets s
           JOIN zones z ON z.id = s.zone_id
           WHERE z.is_active = true AND s.is_active = true AND s.${streetNameColumn} % $1
           ORDER BY similarity DESC
           LIMIT $2 OFFSET $3`,
          [query, limit, offset]
        );
        results.push(...streetResults.rows);
      }

      // Sort combined results by similarity descending
      results.sort((a, b) => b.similarity - a.similarity);

      // Strip similarity from output
      const data = results.slice(0, limit).map(({ similarity, ...rest }) => rest);

      return reply.send({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total: data.length,
          has_more: data.length === limit,
        },
      });
    } catch (err) {
      request.log.error(err, 'Failed to search');
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Search failed' },
      });
    }
  });
}
