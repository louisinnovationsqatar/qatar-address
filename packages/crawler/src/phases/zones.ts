import type pg from 'pg';
import type { QnasClient } from '../qnas-client.js';
import type { RateLimiter } from '../rate-limiter.js';

/**
 * Phase 1 + 2 — Crawl all zones and their polygon boundaries.
 *
 * - Phase 1: `getZones()` -> upsert zone rows.
 * - Phase 2: `getZonePolygon(zone)` -> update `boundary` + compute `centroid`.
 *
 * Already-crawled items (recorded in `crawl_log`) are skipped for resumability.
 */
export async function crawlZones(
  pool: pg.Pool,
  client: QnasClient,
  limiter: RateLimiter,
): Promise<{ zonesUpserted: number; polygonsFetched: number }> {
  let zonesUpserted = 0;
  let polygonsFetched = 0;

  // ---- Phase 1: zone list ----

  const alreadyFetchedList = await pool.query(
    `SELECT 1 FROM crawl_log WHERE endpoint = 'zones_list' AND status = 'success' LIMIT 1`,
  );

  if (alreadyFetchedList.rowCount === 0) {
    const allowed = await limiter.acquire();
    if (!allowed) {
      console.log('[zones] Daily rate limit reached before fetching zone list');
      return { zonesUpserted, polygonsFetched };
    }

    try {
      const zones = await client.getZones();

      for (const z of zones) {
        await pool.query(
          `INSERT INTO zones (zone_number, zone_name, zone_name_ar, source)
           VALUES ($1, $2, $3, 'QNAS_API')
           ON CONFLICT (zone_number)
           DO UPDATE SET zone_name = EXCLUDED.zone_name,
                         zone_name_ar = EXCLUDED.zone_name_ar,
                         source = 'QNAS_API'`,
          [z.zone, z.name_en, z.name_ar],
        );
        zonesUpserted++;
      }

      await logCrawl(pool, 'zones_list', null, null, null, 'success', {
        count: zones.length,
      });
      console.log(`[zones] Phase 1 complete: ${zonesUpserted} zones upserted`);
    } catch (err) {
      await logCrawl(pool, 'zones_list', null, null, null, 'error', {
        error: String(err),
      });
      throw err;
    }
  } else {
    console.log('[zones] Phase 1 skipped (already in crawl_log)');
  }

  // ---- Phase 2: zone polygons ----

  const allZones = await pool.query(
    `SELECT zone_number FROM zones ORDER BY zone_number`,
  );

  for (const row of allZones.rows) {
    const zoneNum: number = row.zone_number;

    const already = await pool.query(
      `SELECT 1 FROM crawl_log
       WHERE endpoint = 'zone_polygon' AND zone_number = $1 AND status = 'success'
       LIMIT 1`,
      [zoneNum],
    );
    if ((already.rowCount ?? 0) > 0) continue;

    const allowed = await limiter.acquire();
    if (!allowed) {
      console.log(
        `[zones] Daily rate limit reached at zone polygon ${zoneNum}`,
      );
      break;
    }

    try {
      const poly = await client.getZonePolygon(zoneNum);
      const geojson = JSON.stringify(poly);

      await pool.query(
        `UPDATE zones
         SET boundary = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
             centroid = ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
         WHERE zone_number = $2`,
        [geojson, zoneNum],
      );

      await logCrawl(pool, 'zone_polygon', zoneNum, null, null, 'success', {
        type: poly.type,
      });
      polygonsFetched++;
    } catch (err) {
      await logCrawl(pool, 'zone_polygon', zoneNum, null, null, 'error', {
        error: String(err),
      });
      console.error(`[zones] Failed to fetch polygon for zone ${zoneNum}:`, err);
    }
  }

  console.log(
    `[zones] Phase 2 complete: ${polygonsFetched} polygons fetched`,
  );
  return { zonesUpserted, polygonsFetched };
}

// ---- helper ----

async function logCrawl(
  pool: pg.Pool,
  endpoint: string,
  zoneNumber: number | null,
  streetNumber: number | null,
  buildingNumber: number | null,
  status: string,
  data: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `INSERT INTO crawl_log (endpoint, zone_number, street_number, building_number, status, response_data)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [endpoint, zoneNumber, streetNumber, buildingNumber, status, JSON.stringify(data)],
  );
}
