import path from 'node:path';

/**
 * Where the JSON store, accounts and session secret live. `GATHERLY_DATA_DIR`
 * points a run at a disposable directory — useful for trying something against
 * throwaway invitations without going near the real guest list.
 */
export function dataDir(): string {
  const override = process.env.GATHERLY_DATA_DIR?.trim();
  return override ? path.resolve(override) : path.join(process.cwd(), '.data');
}
