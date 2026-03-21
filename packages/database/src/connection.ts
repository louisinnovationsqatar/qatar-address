import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const { Pool } = pg;

export function createPool(connectionString?: string): pg.Pool {
  return new Pool({
    connectionString: connectionString || process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

export type { Pool } from 'pg';
