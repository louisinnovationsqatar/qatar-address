import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPool } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveMigrationsDir(): string {
  const fromSrc = path.join(__dirname, 'migrations');
  if (fs.existsSync(fromSrc)) return fromSrc;
  const fromDist = path.resolve(__dirname, '..', 'src', 'migrations');
  if (fs.existsSync(fromDist)) return fromDist;
  throw new Error(`Migrations directory not found. Checked: ${fromSrc}, ${fromDist}`);
}

async function migrate() {
  const pool = createPool();

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows: applied } = await pool.query(
      'SELECT name FROM migrations ORDER BY name'
    );
    const appliedNames = new Set(applied.map((r: { name: string }) => r.name));

    const migrationsDir = resolveMigrationsDir();
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedNames.has(file)) {
        console.log(`SKIP: ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      console.log(`APPLYING: ${file}`);

      await pool.query('BEGIN');
      try {
        await pool.query(sql);
        await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await pool.query('COMMIT');
        console.log(`DONE: ${file}`);
      } catch (err) {
        await pool.query('ROLLBACK');
        console.error(`FAILED: ${file}`, err);
        process.exit(1);
      }
    }

    console.log('All migrations applied.');
  } finally {
    await pool.end();
  }
}

migrate();
