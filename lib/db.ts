import { Pool } from 'pg';

/**
 * One pool for the whole process, created on first use. Next imports every route
 * during `next build` but never queries then, so the connection string is only
 * required once something actually talks to Postgres.
 *
 * The pool lives on globalThis because `next dev` re-evaluates server modules
 * after every edit: a module-level pool would be thrown away and the next
 * request would pay a fresh TLS + login round trip to the database (seconds on
 * a remote Neon instance).
 */
const globalForDb = globalThis as typeof globalThis & { __gatherlyPool?: Pool };

export function getPool(): Pool {
  const pool = globalForDb.__gatherlyPool;
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Put your Neon connection string in .env and restart the server.',
    );
  }

  const created = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 5),
    // A remote database costs ~250ms per round trip, and a closed connection
    // costs seconds to reopen, so keep idle connections around between taps.
    idleTimeoutMillis: 10 * 60_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
  });

  // A pooled client can die between queries; log it rather than crash the process.
  created.on('error', (error) => {
    console.error('postgres pool error:', error.message);
  });

  globalForDb.__gatherlyPool = created;
  return created;
}
