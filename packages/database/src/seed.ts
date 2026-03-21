import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPool } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveSeedsDir(): string {
  const fromSrc = path.join(__dirname, 'seeds');
  if (fs.existsSync(fromSrc)) return fromSrc;
  const fromDist = path.resolve(__dirname, '..', 'src', 'seeds');
  if (fs.existsSync(fromDist)) return fromDist;
  throw new Error(`Seeds directory not found. Checked: ${fromSrc}, ${fromDist}`);
}

async function seed() {
  const pool = createPool();

  try {
    const seedsDir = resolveSeedsDir();
    const files = fs.readdirSync(seedsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(seedsDir, file), 'utf-8');
      console.log(`SEEDING: ${file}`);

      await pool.query('BEGIN');
      try {
        await pool.query(sql);
        await pool.query('COMMIT');
        console.log(`DONE: ${file}`);
      } catch (err) {
        await pool.query('ROLLBACK');
        console.error(`FAILED: ${file}`, err);
        process.exit(1);
      }
    }

    const { rows } = await pool.query('SELECT COUNT(*) as count FROM zones');
    console.log(`Seeded ${rows[0].count} zones.`);
  } finally {
    await pool.end();
  }
}

seed();
