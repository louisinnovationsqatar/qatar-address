import type pg from 'pg';
import { QnasClient } from '../qnas-client.js';
import type { RateLimiter } from '../rate-limiter.js';

/**
 * Phase 3 + 4 — Crawl streets for every zone and their geometries.
 *
 * - Phase 3: `getStreets(zone)` -> upsert into `streets` table.
 * - Phase 4: `getStreetPolygon(zone, street)` -> convert to GeoJSON, update `geometry` column.
 *
 * Skips items already recorded as successful in `crawl_log`.
 */
export async function crawlStreets(
  pool: pg.Pool,
  client: QnasClient,
  limiter: RateLimiter,
): Promise<{ streetsUpserted: number; polygonsFetched: number }> {
  let streetsUpserted = 0;
  let polygonsFetched = 0;

  const allZones = await pool.query(
    `SELECT id, zone_number FROM zones ORDER BY zone_number`,
  );

  // ---- Phase 3: street lists per zone ----

  for (const zoneRow of allZones.rows) {
    const zoneId: number = zoneRow.id;
    const zoneNum: number = zoneRow.zone_number;

    const already = await pool.query(
      `SELECT 1 FROM crawl_log
       WHERE endpoint = 'streets_list' AND zone_number = $1 AND status = 'success'
       LIMIT 1`,
      [zoneNum],
    );
    if ((already.rowCount ?? 0) > 0) continue;

    await limiter.acquire();

    try {
      const streets = await client.getStreets(zoneNum);

      for (const s of streets) {
        await pool.query(
          `INSERT INTO streets (zone_id, street_number, street_name, street_name_ar, source)
           VALUES ($1, $2, $3, $4, 'QNAS_API')
           ON CONFLICT (zone_id, street_number)
           DO UPDATE SET street_name = EXCLUDED.street_name,
                         street_name_ar = EXCLUDED.street_name_ar,
                         source = 'QNAS_API'`,
          [zoneId, s.street_number, s.street_name_en, s.street_name_ar],
        );
        streetsUpserted++;
      }

      await logCrawl(pool, 'streets_list', zoneNum, null, null, 'success', {
        count: streets.length,
      });
      console.log(
        `[streets] Phase 3: zone ${zoneNum} — ${streets.length} streets upserted`,
      );
    } catch (err) {
      await logCrawl(pool, 'streets_list', zoneNum, null, null, 'error', {
        error: String(err),
      });
      console.error(
        `[streets] Failed to fetch streets for zone ${zoneNum}:`,
        err,
      );
    }
  }

  // ---- Phase 4: street polygons ----

  const allStreets = await pool.query(
    `SELECT s.id, s.street_number, z.zone_number
     FROM streets s
     JOIN zones z ON z.id = s.zone_id
     ORDER BY z.zone_number, s.street_number`,
  );

  for (const streetRow of allStreets.rows) {
    const zoneNum: number = streetRow.zone_number;
    const streetNum: number = streetRow.street_number;

    const already = await pool.query(
      `SELECT 1 FROM crawl_log
       WHERE endpoint = 'street_polygon'
         AND zone_number = $1
         AND street_number = $2
         AND status = 'success'
       LIMIT 1`,
      [zoneNum, streetNum],
    );
    if ((already.rowCount ?? 0) > 0) continue;

    await limiter.acquire();

    try {
      const response = await client.getStreetPolygon(zoneNum, streetNum);

      if (response.polygon && response.polygon.length > 0) {
        const geojson = JSON.stringify(
          QnasClient.polygonToGeoJSON(response.polygon),
        );

        await pool.query(
          `UPDATE streets
           SET geometry = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)
           WHERE id = $2`,
          [geojson, streetRow.id],
        );
      }

      await logCrawl(
        pool,
        'street_polygon',
        zoneNum,
        streetNum,
        null,
        'success',
        { pointCount: response.polygon?.length ?? 0 },
      );
      polygonsFetched++;
    } catch (err) {
      await logCrawl(
        pool,
        'street_polygon',
        zoneNum,
        streetNum,
        null,
        'error',
        { error: String(err) },
      );
      console.error(
        `[streets] Failed to fetch polygon for zone=${zoneNum} street=${streetNum}:`,
        err,
      );
    }
  }

  console.log(
    `[streets] Complete: ${streetsUpserted} streets upserted, ${polygonsFetched} polygons fetched`,
  );
  return { streetsUpserted, polygonsFetched };
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
