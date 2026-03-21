import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/api/src/server.js';
import type { FastifyInstance } from 'fastify';

describe('Zones API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://qatar:qatar@localhost:5432/qatar_address';
    process.env.REDIS_URL = 'redis://localhost:6379';
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
    expect(body.pagination.total).toBeGreaterThan(0);
  });

  it('GET /api/v1/zones/25 returns Dafna', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/zones/25' });
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.data.zone_name).toBe('Dafna');
  });

  it('GET /api/v1/zones/999 returns 422', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/zones/999' });
    expect(response.statusCode).toBe(422);
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
