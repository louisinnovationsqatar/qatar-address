/**
 * Export all crawled data to static JSON / GeoJSON files.
 *
 * Output structure (written to `data/export/`):
 *   zones.json                        — flat array of zone records
 *   zones-polygons.geojson            — FeatureCollection of zone boundaries
 *   streets/zone-XX.json              — streets per zone
 *   buildings/zone-XX/street-XXX.json — buildings per street
 *   manifest.json                     — metadata about this export
 */

import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config({ path: '../../.env' });

const EXPORT_DIR = path.resolve('../../data/export');

interface ExportManifest {
  version: string;
  exported_at: string;
  counts: {
    zones: number;
    streets: number;
    buildings: number;
  };
  sources: string[];
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
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

  try {
    console.log(`Exporting to ${EXPORT_DIR}`);
    fs.mkdirSync(EXPORT_DIR, { recursive: true });

    // ---- zones.json ----
    const zones = await pool.query(
      `SELECT zone_number, zone_name, zone_name_ar, municipality, municipality_ar,
              source, is_active
       FROM zones ORDER BY zone_number`,
    );
    writeJson('zones.json', zones.rows);
    console.log(`  zones.json: ${zones.rows.length} zones`);

    // ---- zones-polygons.geojson ----
    const zonePolygons = await pool.query(
      `SELECT zone_number, zone_name, zone_name_ar,
              ST_AsGeoJSON(boundary)::json AS geometry,
              ST_Y(centroid) AS centroid_lat,
              ST_X(centroid) AS centroid_lng
       FROM zones
       WHERE boundary IS NOT NULL
       ORDER BY zone_number`,
    );

    const geojson = {
      type: 'FeatureCollection',
      features: zonePolygons.rows.map(
        (r: Record<string, unknown>) => ({
          type: 'Feature',
          properties: {
            zone_number: r.zone_number,
            zone_name: r.zone_name,
            zone_name_ar: r.zone_name_ar,
            centroid_lat: r.centroid_lat,
            centroid_lng: r.centroid_lng,
          },
          geometry: r.geometry,
        }),
      ),
    };
    writeJson('zones-polygons.geojson', geojson);
    console.log(
      `  zones-polygons.geojson: ${geojson.features.length} features`,
    );

    // ---- streets per zone ----
    const streetsDir = path.join(EXPORT_DIR, 'streets');
    fs.mkdirSync(streetsDir, { recursive: true });

    let totalStreets = 0;
    for (const zoneRow of zones.rows) {
      const zn = (zoneRow as Record<string, unknown>).zone_number as number;
      const streets = await pool.query(
        `SELECT s.street_number, s.street_name, s.street_name_ar, s.source, s.is_active
         FROM streets s
         JOIN zones z ON z.id = s.zone_id
         WHERE z.zone_number = $1
         ORDER BY s.street_number`,
        [zn],
      );
      if (streets.rows.length > 0) {
        const filename = `zone-${String(zn).padStart(2, '0')}.json`;
        writeJson(path.join('streets', filename), streets.rows);
        totalStreets += streets.rows.length;
      }
    }
    console.log(`  streets/: ${totalStreets} streets across ${zones.rows.length} zones`);

    // ---- buildings per zone/street ----
    let totalBuildings = 0;
    for (const zoneRow of zones.rows) {
      const zn = (zoneRow as Record<string, unknown>).zone_number as number;
      const znPad = String(zn).padStart(2, '0');
      const buildingsZoneDir = path.join(EXPORT_DIR, 'buildings', `zone-${znPad}`);

      const streets = await pool.query(
        `SELECT s.id, s.street_number
         FROM streets s
         JOIN zones z ON z.id = s.zone_id
         WHERE z.zone_number = $1
         ORDER BY s.street_number`,
        [zn],
      );

      for (const sRow of streets.rows) {
        const sNum = (sRow as Record<string, unknown>).street_number as number;
        const sId = (sRow as Record<string, unknown>).id as number;

        const buildings = await pool.query(
          `SELECT b.building_number,
                  ST_Y(b.location) AS latitude,
                  ST_X(b.location) AS longitude,
                  b.source, b.verified
           FROM buildings b
           WHERE b.street_id = $1
           ORDER BY b.building_number`,
          [sId],
        );

        if (buildings.rows.length > 0) {
          fs.mkdirSync(buildingsZoneDir, { recursive: true });
          const filename = `street-${String(sNum).padStart(3, '0')}.json`;
          writeJson(
            path.join('buildings', `zone-${znPad}`, filename),
            buildings.rows,
          );
          totalBuildings += buildings.rows.length;
        }
      }
    }
    console.log(
      `  buildings/: ${totalBuildings} buildings`,
    );

    // ---- manifest.json ----
    const sources = await pool.query(
      `SELECT DISTINCT source FROM (
         SELECT source FROM zones
         UNION ALL SELECT source FROM streets
         UNION ALL SELECT source FROM buildings
       ) s ORDER BY source`,
    );

    const manifest: ExportManifest = {
      version: '0.1.0',
      exported_at: new Date().toISOString(),
      counts: {
        zones: zones.rows.length,
        streets: totalStreets,
        buildings: totalBuildings,
      },
      sources: sources.rows.map(
        (r: Record<string, unknown>) => r.source as string,
      ),
    };
    writeJson('manifest.json', manifest);
    console.log('  manifest.json written');

    console.log('Export complete.');
  } catch (err) {
    console.error('Export failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

function writeJson(relativePath: string, data: unknown): void {
  const fullPath = path.join(EXPORT_DIR, relativePath);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

main();
