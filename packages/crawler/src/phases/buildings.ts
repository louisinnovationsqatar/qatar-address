import type pg from 'pg';
import type { QnasClient } from '../qnas-client.js';
import type { RateLimiter } from '../rate-limiter.js';

/**
 * Phase 5 + 6 — Crawl buildings and their exact coordinates.
 *
 * - Phase 5: `getBuildings(zone, street)` -> insert with placeholder (0,0).
 * - Phase 6: `getLocation(zone, street, building)` -> update exact coordinates.
 *
 * Skips items already recorded as successful in `crawl_log`.
 */
export async function crawlBuildings(
  pool: pg.Pool,
  client: QnasClient,
  limiter: RateLimiter,
): Promise<{ buildingsInserted: number; locationsFetched: number }> {
  let buildingsInserted = 0;
  let locationsFetched = 0;

  // ---- Phase 5: building lists per zone/street ----

  const allStreets = await pool.query(
    `SELECT s.id AS street_id, s.street_number, z.zone_number
     FROM streets s
     JOIN zones z ON z.id = s.zone_id
     ORDER BY z.zone_number, s.street_number`,
  );

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
    if ((already.rowCount ?? 0) > 0) continue;

    const allowed = await limiter.acquire();
    if (!allowed) {
      console.log(
        `[buildings] Daily rate limit reached at building list zone=${zoneNum} street=${streetNum}`,
      );
      return { buildingsInserted, locationsFetched };
    }

    try {
      const buildings = await client.getBuildings(zoneNum, streetNum);

      for (const b of buildings) {
        await pool.query(
          `INSERT INTO buildings (street_id, building_number, location, source)
           VALUES ($1, $2, ST_SetSRID(ST_MakePoint(0, 0), 4326), 'QNAS_API')
           ON CONFLICT (street_id, building_number) DO NOTHING`,
          [streetId, b.building],
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
      console.log(
        `[buildings] Phase 5: zone=${zoneNum} street=${streetNum} — ${buildings.length} buildings`,
      );
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
        `[buildings] Failed to fetch buildings for zone=${zoneNum} street=${streetNum}:`,
        err,
      );
    }
  }

  // ---- Phase 6: exact coordinates per building ----

  const unlocated = await pool.query(
    `SELECT b.id, b.building_number, s.street_number, z.zone_number
     FROM buildings b
     JOIN streets s ON s.id = b.street_id
     JOIN zones z ON z.id = s.zone_id
     WHERE ST_X(b.location) = 0 AND ST_Y(b.location) = 0
     ORDER BY z.zone_number, s.street_number, b.building_number`,
  );

  for (const bRow of unlocated.rows) {
    const zoneNum: number = bRow.zone_number;
    const streetNum: number = bRow.street_number;
    const buildingNum: number = bRow.building_number;
    const buildingId: number = bRow.id;

    const already = await pool.query(
      `SELECT 1 FROM crawl_log
       WHERE endpoint = 'building_location'
         AND zone_number = $1
         AND street_number = $2
         AND building_number = $3
         AND status = 'success'
       LIMIT 1`,
      [zoneNum, streetNum, buildingNum],
    );
    if ((already.rowCount ?? 0) > 0) continue;

    const allowed = await limiter.acquire();
    if (!allowed) {
      console.log(
        `[buildings] Daily rate limit reached at location zone=${zoneNum} street=${streetNum} building=${buildingNum}`,
      );
      break;
    }

    try {
      const loc = await client.getLocation(zoneNum, streetNum, buildingNum);

      await pool.query(
        `UPDATE buildings
         SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)
         WHERE id = $3`,
        [loc.lng, loc.lat, buildingId],
      );

      await logCrawl(
        pool,
        'building_location',
        zoneNum,
        streetNum,
        buildingNum,
        'success',
        { lat: loc.lat, lng: loc.lng },
      );
      locationsFetched++;
    } catch (err) {
      await logCrawl(
        pool,
        'building_location',
        zoneNum,
        streetNum,
        buildingNum,
        'error',
        { error: String(err) },
      );
      console.error(
        `[buildings] Failed to fetch location for zone=${zoneNum} street=${streetNum} building=${buildingNum}:`,
        err,
      );
    }
  }

  console.log(
    `[buildings] Complete: ${buildingsInserted} buildings inserted, ${locationsFetched} locations fetched`,
  );
  return { buildingsInserted, locationsFetched };
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
