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

const UPSERT = `
  insert into invitations
    (id, owner_id, title, design_slug, starts_at, created_at, updated_at, collaborators, document)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  on conflict (id) do update set
    owner_id = excluded.owner_id,
    title = excluded.title,
    design_slug = excluded.design_slug,
    starts_at = excluded.starts_at,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    collaborators = excluded.collaborators,
    document = excluded.document
`;

const client = new Client({ connectionString });
await client.connect();

try {
  await client.query('begin');

  for (const inv of invitations) {
    const now = new Date().toISOString();
    const starts = inv.event?.startsAt ? new Date(inv.event.startsAt) : null;
    await client.query(UPSERT, [
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
  }

  await client.query('commit');
} catch (error) {
  await client.query('rollback');
  console.error(`Import failed, nothing was written: ${error.message}`);
  process.exit(1);
}

const expectedGuests = invitations.reduce((sum, inv) => sum + (inv.guests?.length ?? 0), 0);
const expectedOwners = new Set(invitations.map((inv) => inv.ownerId).filter(Boolean)).size;

const { rows } = await client.query(`
  select count(*)::int as invitations,
         coalesce(sum(jsonb_array_length(document->'guests')), 0)::int as guests,
         count(distinct owner_id)::int as owners
    from invitations
`);
const counts = rows[0];
await client.end();

console.log(`imported ${invitations.length} invitations from ${source}`);
console.log(
  `database now holds ${counts.invitations} invitations, ${counts.guests} guest rows, ${counts.owners} owners`,
);
console.log(
  `expected ${invitations.length} invitations, ${expectedGuests} guest rows, ${expectedOwners} owners`,
);
if (counts.invitations !== invitations.length || counts.guests !== expectedGuests) {
  console.error('Counts do not match what was imported.');
  process.exit(1);
}
