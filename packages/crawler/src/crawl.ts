/**
 * Crawl orchestrator — entry point for `pnpm crawl`.
 *
 * Reads QNAS_API_TOKEN / QNAS_API_DOMAIN from the environment, creates a
 * connection pool, rate limiter, and runs the crawl phases in order:
 *   zones (list + polygons) -> streets (list + polygons) -> buildings (list with coords).
 *
 * Buildings phase gets coordinates directly from get_buildings — no need for
 * per-building get_location calls (saves ~100k+ API requests).
 */

import dotenv from 'dotenv';
import pg from 'pg';
import { QnasClient } from './qnas-client.js';
import { RateLimiter } from './rate-limiter.js';
import { crawlZones } from './phases/zones.js';
import { crawlStreets } from './phases/streets.js';
import { crawlBuildings } from './phases/buildings.js';

dotenv.config({ path: '../../.env' });

async function main(): Promise<void> {
  const token = process.env.QNAS_API_TOKEN;
  const domain = process.env.QNAS_API_DOMAIN;
  const databaseUrl = process.env.DATABASE_URL;

  if (!token || !domain) {
    console.error(
      'Missing QNAS_API_TOKEN or QNAS_API_DOMAIN environment variables.',
    );
    process.exit(1);
  }

  if (!databaseUrl) {
    console.error('Missing DATABASE_URL environment variable.');
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  const client = new QnasClient({
    token,
    domain,
    baseUrl: process.env.QNAS_BASE_URL || 'https://qnas.qa',
  });

  // 1 request per 1.8 seconds = ~33/min (safely under QNAS IP limit of 36/min)
  const limiter = new RateLimiter();

  const startTime = Date.now();
  console.log('=== Qatar Address Crawler ===');
  console.log(`Started at ${new Date().toISOString()}`);
  console.log(`Rate: ~33 req/min (1 per 1.8s)`);
  console.log();

  try {
    // Cleanup old crawl_log entries (older than 90 days)
    const cleanup = await pool.query(
      `DELETE FROM crawl_log WHERE created_at < NOW() - INTERVAL '90 days'`,
    );
    if ((cleanup.rowCount ?? 0) > 0) {
      console.log(
        `Cleaned up ${cleanup.rowCount} old crawl_log entries (>90 days)`,
      );
    }

    // Phase 1 + 2: Zones (list + polygons)
    console.log('--- Zones (Phase 1 + 2) ---');
    const zoneStats = await crawlZones(pool, client, limiter);
    console.log();

    // Phase 3 + 4: Streets (list + polygons)
    console.log('--- Streets (Phase 3 + 4) ---');
    const streetStats = await crawlStreets(pool, client, limiter);
    console.log();

    // Phase 5: Buildings (list with coordinates)
    console.log('--- Buildings (Phase 5) ---');
    const buildingStats = await crawlBuildings(pool, client, limiter);
    console.log();

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('=== Summary ===');
    console.log(`Zones upserted:      ${zoneStats.zonesUpserted}`);
    console.log(`Zone polygons:       ${zoneStats.polygonsFetched}`);
    console.log(`Streets upserted:    ${streetStats.streetsUpserted}`);
    console.log(`Street polygons:     ${streetStats.polygonsFetched}`);
    console.log(`Buildings inserted:  ${buildingStats.buildingsInserted}`);
    console.log(`Total API calls:     ${limiter.dailyCount}`);
    console.log(`Elapsed:             ${elapsed}s`);
  } catch (err) {
    console.error('Crawl failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
