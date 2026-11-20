import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';

/**
 * Snapshots the database in DATABASE_URL into the layout the import scripts
 * read, so moving data between the local server and the hosted one is
 * `db:use:… && db:export && db:use:… && db:import…` instead of a one-off script.
 *
 * The imported files are not a backup format: passwords travel as their existing
 * scrypt salt + hash, and the session signing secret comes along too, which is
 * what keeps cookies valid on the other side.
 */
const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error('DATABASE_URL is not set. Add your Postgres connection string to .env first.');
  process.exit(1);
}

const outDir = path.resolve(
  process.argv[2] || process.env.GATHERLY_EXPORT_DIR || path.join('.data', 'export'),
);

const describe = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}`;
  } catch {
    return 'unreadable URL';
  }
};

const client = new Client({ connectionString });
await client.connect();

try {
  await mkdir(outDir, { recursive: true });

  const invitations = await client.query('select id, document from invitations order by created_at');
  const byId = {};
  for (const row of invitations.rows) byId[row.id] = row.document;
  await writeFile(
    path.join(outDir, 'invitations.json'),
    `${JSON.stringify({ invitations: byId }, null, 2)}\n`,
  );

  const users = await client.query(
    `select id, name, email, salt, hash, created_at, password_changed_at, reset_hash, reset_expires
       from users order by created_at`,
  );
  const iso = (value) => (value instanceof Date ? value.toISOString() : value);
  await writeFile(
    path.join(outDir, 'users.json'),
    `${JSON.stringify(
      {
        users: users.rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          salt: row.salt,
          hash: row.hash,
          createdAt: iso(row.created_at),
          passwordChangedAt: iso(row.password_changed_at),
          resetHash: row.reset_hash ?? undefined,
          resetExpires: row.reset_expires === null ? undefined : Number(row.reset_expires),
        })),
      },
      null,
      2,
    )}\n`,
  );

  const secret = await client.query("select value from app_settings where key = 'session_secret'");
  const hasSecret = Boolean(secret.rows[0]?.value);
  if (hasSecret) await writeFile(path.join(outDir, 'session-secret'), `${secret.rows[0].value}\n`);

  console.log(`exported ${invitations.rows.length} invitations and ${users.rows.length} accounts`);
  console.log(`from ${describe(connectionString)}`);
  console.log(`into ${outDir} (session secret ${hasSecret ? 'included' : 'MISSING'})`);
  console.log('Import it elsewhere with:');
  console.log(`  GATHERLY_DATA_DIR=${path.relative(process.cwd(), outDir) || '.'} npm run db:import-users`);
  console.log(`  GATHERLY_DATA_DIR=${path.relative(process.cwd(), outDir) || '.'} npm run db:import`);
} finally {
  await client.end();
}
