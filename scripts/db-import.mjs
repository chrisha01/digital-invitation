import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error('DATABASE_URL is not set. Add your Neon connection string to .env first.');
  process.exit(1);
}

const source = process.env.GATHERLY_DATA_DIR
  ? path.join(process.env.GATHERLY_DATA_DIR, 'invitations.json')
  : path.join(process.cwd(), '.data', 'invitations.json');

let parsed;
try {
  parsed = JSON.parse(await readFile(source, 'utf8'));
} catch (error) {
  console.error(`Could not read ${source}: ${error.message}`);
  process.exit(1);
}

const invitations = Object.values(parsed?.invitations ?? {});
if (!invitations.length) {
  console.log('Nothing to import.');
  process.exit(0);
}

// Insert only. An invitation the database already holds may have been edited
// since the last import, and re-importing the old JSON must never undo that.
const INSERT = `
  insert into invitations
    (id, owner_id, title, design_slug, starts_at, created_at, updated_at, collaborators, document)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  on conflict (id) do nothing
`;

const client = new Client({ connectionString });
await client.connect();

let inserted = 0;
let skipped = 0;

try {
  await client.query('begin');

  for (const inv of invitations) {
    const now = new Date().toISOString();
    const starts = inv.event?.startsAt ? new Date(inv.event.startsAt) : null;
    const result = await client.query(INSERT, [
      inv.id,
      inv.ownerId ?? null,
      inv.title ?? '',
      inv.designSlug ?? '',
      starts && !Number.isNaN(starts.getTime()) ? starts.toISOString() : null,
      inv.createdAt || now,
      inv.updatedAt || now,
      (inv.collaborators ?? []).map((entry) => String(entry).toLowerCase()),
      inv,
    ]);
    if (result.rowCount) inserted += 1;
    else skipped += 1;
  }

  await client.query('commit');
} catch (error) {
  await client.query('rollback');
  console.error(`Import failed, nothing was written: ${error.message}`);
  process.exit(1);
}

// Every id in the file should now exist, whether it was just added or was
// already there and left untouched.
const { rows } = await client.query(
  `select count(*)::int as present from invitations where id = any($1::text[])`,
  [invitations.map((inv) => inv.id)],
);
const present = rows[0].present;
await client.end();

console.log(`read ${invitations.length} invitations from ${source}`);
console.log(`added ${inserted} new, left ${skipped} already present untouched`);
console.log(`all ${present} of them are in the database`);

if (present !== invitations.length) {
  console.error('Some invitations from the file are missing from the database.');
  process.exit(1);
}
