import type pg from 'pg';
import type { QnasClient } from '../qnas-client.js';
import type { RateLimiter } from '../rate-limiter.js';

/**
 * Phase 5 — Crawl buildings with coordinates in a single pass.
 *
 * The QNAS `/get_buildings/{zone}/{street}` endpoint returns buildings WITH
 * their lat/lng coordinates (x=lat, y=lng). This eliminates the need for
 * per-building `/get_location` calls, saving ~100k+ API requests.
 *
 * Skips items already recorded as successful in `crawl_log`.
 */
export async function crawlBuildings(
  pool: pg.Pool,
  client: QnasClient,
  limiter: RateLimiter,
): Promise<{ buildingsInserted: number }> {
  let buildingsInserted = 0;

  const allStreets = await pool.query(
    `SELECT s.id AS street_id, s.street_number, z.zone_number
     FROM streets s
     JOIN zones z ON z.id = s.zone_id
     ORDER BY z.zone_number, s.street_number`,
  );

  const totalStreets = allStreets.rows.length;
  let processedStreets = 0;

  for (const streetRow of allStreets.rows) {
    const zoneNum: number = streetRow.zone_number;
    const streetNum: number = streetRow.street_number;
    const streetId: number = streetRow.street_id;

    const already = await pool.query(
      `SELECT 1 FROM crawl_log
       WHERE endpoint = 'buildings_list'
         AND zone_number = $1
         AND street_number = $2
         AND status = 'success'
       LIMIT 1`,
      [zoneNum, streetNum],
    );
    if ((already.rowCount ?? 0) > 0) {
      processedStreets++;
      continue;
    }

    await limiter.acquire();

    try {
      const buildings = await client.getBuildings(zoneNum, streetNum);

      for (const b of buildings) {
        const buildingNum = parseInt(b.building_number, 10);
        const lat = parseFloat(b.x);
        const lng = parseFloat(b.y);

        if (isNaN(buildingNum) || isNaN(lat) || isNaN(lng)) continue;

        // Insert with real coordinates directly — no Phase 6 needed
        await pool.query(
          `INSERT INTO buildings (street_id, building_number, location, source, verified)
           VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), 'QNAS_API', true)
           ON CONFLICT (street_id, building_number)
           DO UPDATE SET location = ST_SetSRID(ST_MakePoint($3, $4), 4326),
                         source = 'QNAS_API',
                         verified = true`,
          [streetId, buildingNum, lng, lat],
        );
        buildingsInserted++;
      }

      await logCrawl(
        pool,
        'buildings_list',
        zoneNum,
        streetNum,
        null,
        'success',
        { count: buildings.length },
      );

      processedStreets++;
      if (processedStreets % 50 === 0 || buildings.length > 0) {
        console.log(
          `[buildings] zone=${zoneNum} street=${streetNum} — ${buildings.length} buildings (${processedStreets}/${totalStreets} streets)`,
        );
      }
    } catch (err) {
      await logCrawl(
        pool,
        'buildings_list',
        zoneNum,
        streetNum,
        null,
        'error',
        { error: String(err) },
      );
      console.error(
        `[buildings] Failed for zone=${zoneNum} street=${streetNum}:`,
        err,
      );
    }
  }

  console.log(
    `[buildings] Complete: ${buildingsInserted} buildings inserted with coordinates`,
  );
  return { buildingsInserted };
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
