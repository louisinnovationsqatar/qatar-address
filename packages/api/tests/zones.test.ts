import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';

const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)('Zones API (integration)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/zones returns paginated zones', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/zones' });
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.pagination).toBeDefined();
  });

  it('GET /api/v1/zones/25 returns zone data', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/zones/25' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.zone_number).toBe(25);
  });

  it('GET /api/v1/zones/999 returns 400 for out-of-range zone', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/zones/999' });
    expect(response.statusCode).toBe(400);
  });

  it('GET /api/v1/health returns ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.data.database).toBe(true);
  });

  it('GET /api/v1/validate?zone=25 returns valid', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/validate?zone=25' });
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.data.valid).toBe(true);
    expect(body.data.zone_exists).toBe(true);
  });
});
