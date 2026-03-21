import type pg from 'pg';
import { QnasClient } from '../qnas-client.js';
import type { RateLimiter } from '../rate-limiter.js';

/**
 * Phase 1 + 2 — Crawl all zones and their polygon boundaries.
 *
 * - Phase 1: `getZones()` -> upsert zone rows.
 * - Phase 2: `getZonePolygon(zone)` -> convert to GeoJSON, update `boundary` + compute `centroid`.
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
    await limiter.acquire();

    try {
      const zones = await client.getZones();

      // Deduplicate zones (QNAS returns multiple entries per zone_number for sub-areas)
      const uniqueZones = new Map<number, { name_en: string; name_ar: string }>();
      for (const z of zones) {
        if (z.zone_number === 0) continue; // Skip zone 0 (unnamed areas)
        if (!uniqueZones.has(z.zone_number)) {
          uniqueZones.set(z.zone_number, {
            name_en: z.zone_name_en,
            name_ar: z.zone_name_ar,
          });
        }
      }

      for (const [zoneNum, z] of uniqueZones) {
        await pool.query(
          `INSERT INTO zones (zone_number, zone_name, zone_name_ar, source)
           VALUES ($1, $2, $3, 'QNAS_API')
           ON CONFLICT (zone_number)
           DO UPDATE SET zone_name = EXCLUDED.zone_name,
                         zone_name_ar = EXCLUDED.zone_name_ar,
                         source = 'QNAS_API'`,
          [zoneNum, z.name_en, z.name_ar],
        );
        zonesUpserted++;
      }

      await logCrawl(pool, 'zones_list', null, null, null, 'success', {
        rawCount: zones.length,
        uniqueCount: uniqueZones.size,
      });
      console.log(
        `[zones] Phase 1 complete: ${zonesUpserted} zones upserted (${zones.length} raw entries)`,
      );
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

    await limiter.acquire();

    try {
      const response = await client.getZonePolygon(zoneNum);

      if (response.polygon && response.polygon.length > 0) {
        const geojson = JSON.stringify(
          QnasClient.polygonToGeoJSON(response.polygon),
        );

        await pool.query(
          `UPDATE zones
           SET boundary = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
               centroid = ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
           WHERE zone_number = $2`,
          [geojson, zoneNum],
        );
      }

      await logCrawl(pool, 'zone_polygon', zoneNum, null, null, 'success', {
        pointCount: response.polygon?.length ?? 0,
      });
      polygonsFetched++;
      console.log(
        `[zones] Phase 2: zone ${zoneNum} polygon (${response.polygon?.length ?? 0} points)`,
      );
    } catch (err) {
      await logCrawl(pool, 'zone_polygon', zoneNum, null, null, 'error', {
        error: String(err),
      });
      console.error(
        `[zones] Failed to fetch polygon for zone ${zoneNum}:`,
        err,
      );
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
