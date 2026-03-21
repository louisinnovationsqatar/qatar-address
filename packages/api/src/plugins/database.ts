import fp from 'fastify-plugin';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    pg: pg.Pool;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
  });
  await pool.query('SELECT 1');
  fastify.decorate('pg', pool);
  fastify.addHook('onClose', async () => { await pool.end(); });
}, { name: 'database' });
