import { Pool } from 'pg';

/**
 * One pool for the whole process, created on first use. Next imports every route
 * during `next build` but never queries then, so the connection string is only
 * required once something actually talks to Postgres.
 */
let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Put your Neon connection string in .env and restart the server.',
    );
  }

  pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  // A pooled client can die between queries; log it rather than crash the process.
  pool.on('error', (error) => {
    console.error('postgres pool error:', error.message);
  });

  return pool;
}
