import { getPool } from './db';
import { deleteStoredKey, listStoredImages, objectKey, storageConfigured } from './storage';
import { listImageUrls } from './store';

export type SweepResult = {
  listed: number;
  referenced: number;
  orphans: { key: string; lastModified: string }[];
  deleted: string[];
  failed: { key: string; error: string }[];
  graceHours: number;
  dryRun: boolean;
};

export type SweepOptions = { remove?: boolean; graceHours?: number };

/** The sweep is only meaningful when there is a bucket to list. */
export function sweepConfigured(): boolean {
  return storageConfigured();
}

/**
 * Finds objects no invitation references, and removes them when asked.
 * Objects younger than the grace window are kept so an upload still being saved
 * cannot be swept out from under the person who chose it.
 */
export async function sweepImages({
  remove = false,
  graceHours = 24,
}: SweepOptions = {}): Promise<SweepResult> {
  const [objects, urls] = await Promise.all([listStoredImages(), listImageUrls()]);

  const referenced = new Set(
    urls.map((url) => objectKey(url)).filter((key): key is string => Boolean(key)),
  );
  const cutoff = Date.now() - graceHours * 60 * 60 * 1000;
  const orphans = objects
    .filter((object) => !referenced.has(object.key) && object.lastModified.getTime() < cutoff)
    .map((object) => ({ key: object.key, lastModified: object.lastModified.toISOString() }));

  const deleted: string[] = [];
  const failed: { key: string; error: string }[] = [];

  if (remove) {
    for (const orphan of orphans) {
      try {
        await deleteStoredKey(orphan.key);
        deleted.push(orphan.key);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ key: orphan.key, error: message });
        console.error(`[sweep] could not delete ${orphan.key}: ${message}`);
      }
    }
  }

  return {
    listed: objects.length,
    referenced: referenced.size,
    orphans,
    deleted,
    failed,
    graceHours,
    dryRun: !remove,
  };
}

/** One row per run, so the history is queryable rather than only in stdout. */
export async function recordSweepRun(
  result: SweepResult | null,
  startedAt: Date,
  error: string | null,
): Promise<void> {
  await getPool().query(
    `insert into job_runs (job, started_at, finished_at, status, scanned, referenced, deleted, error)
     values ('sweep-images', $1, now(), $2, $3, $4, $5, $6)`,
    [
      startedAt,
      error ? 'failed' : 'ok',
      result?.listed ?? 0,
      result?.referenced ?? 0,
      JSON.stringify(result?.deleted ?? []),
      error,
    ],
  );
}

/** Advisory lock id shared by every caller. */
const SWEEP_LOCK = 728_190_331;

/** How long a run stays queryable; older rows are pruned on each sweep. */
function retentionDays(): number {
  const configured = Number(process.env.JOB_RUNS_RETENTION_DAYS ?? '30');
  return Number.isFinite(configured) && configured >= 1 ? configured : 30;
}

/** Keeps job_runs from growing without bound. Returns how many rows went. */
export async function pruneJobRuns(days = retentionDays()): Promise<number> {
  const { rowCount } = await getPool().query(
    'delete from job_runs where started_at < now() - make_interval(days => $1) and id < (select max(id) from job_runs)',
    [days],
  );
  return rowCount ?? 0;
}

/**
 * Runs one sweep, unless another run currently holds the lock, and records it.
 *
 * The lock is transaction-scoped on purpose: this database is reached through a
 * transaction pooler, where a session-level advisory lock can land on different
 * backends between statements and stop excluding anything. Inside one
 * transaction the statements share a backend, so the lock means what it says.
 */
export async function runSweepJob(
  options: SweepOptions = { remove: true },
): Promise<{ ran: false } | { ran: true; result: SweepResult }> {
  const startedAt = new Date();
  const client = await getPool().connect();

  try {
    await client.query('begin');
    const { rows } = await client.query<{ locked: boolean }>(
      'select pg_try_advisory_xact_lock($1) as locked',
      [SWEEP_LOCK],
    );
    if (!rows[0]?.locked) {
      await client.query('rollback');
      return { ran: false };
    }

    const result = await sweepImages(options);
    await client.query('commit');

    await recordSweepRun(result, startedAt, null);
    const pruned = await pruneJobRuns().catch((error) => {
      console.error('[sweep] could not prune old runs:', error instanceof Error ? error.message : error);
      return 0;
    });
    if (pruned) console.log(`[sweep] pruned ${pruned} run(s) older than ${retentionDays()} day(s)`);
    console.log(
      `[sweep] listed ${result.listed}, referenced ${result.referenced}, deleted ${result.deleted.length}`,
      result.deleted.length ? result.deleted : '',
    );
    return { ran: true, result };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[sweep] failed: ${message}`);
    await recordSweepRun(null, startedAt, message).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
