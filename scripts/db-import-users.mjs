import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error('DATABASE_URL is not set. Add your Neon connection string to .env first.');
  process.exit(1);
}

const dir = process.env.GATHERLY_DATA_DIR
  ? path.resolve(process.env.GATHERLY_DATA_DIR)
  : path.join(process.cwd(), '.data');

const readJson = async (file) => JSON.parse(await readFile(path.join(dir, file), 'utf8'));

let usersDb;
try {
  usersDb = await readJson('users.json');
} catch (error) {
  console.error(`Could not read ${path.join(dir, 'users.json')}: ${error.message}`);
  process.exit(1);
}

const users = Array.isArray(usersDb?.users) ? usersDb.users : [];
if (!users.length) {
  console.log('No accounts to import.');
  process.exit(0);
}

// The signing key has to come across too, otherwise every cookie already in a
// browser would stop verifying the moment the app starts reading from Postgres.
let secret = null;
try {
  secret = (await readFile(path.join(dir, 'session-secret'), 'utf8')).trim() || null;
} catch {
  secret = null;
}

const client = new Client({ connectionString });
await client.connect();

let added = 0;
let skipped = 0;

try {
  await client.query('begin');

  for (const user of users) {
    const createdAt = user.createdAt || new Date().toISOString();
    // Sessions were issued against this value, so it must survive the move.
    const changedAt = user.passwordChangedAt || createdAt;
    const result = await client.query(
      `insert into users (id, name, email, salt, hash, created_at, password_changed_at, reset_hash, reset_expires)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (email) do nothing`,
      [
        user.id,
        user.name,
        String(user.email).trim().toLowerCase(),
        user.salt,
        user.hash,
        createdAt,
        changedAt,
        user.resetHash ?? null,
        user.resetExpires ?? null,
      ],
    );
    if (result.rowCount) added += 1;
    else skipped += 1;
  }

  if (secret) {
    // Insert-only: an existing key always wins, so re-running cannot rotate it.
    await client.query(
      "insert into app_settings (key, value) values ('session_secret', $1) on conflict (key) do nothing",
      [secret],
    );
  }

  await client.query('commit');
} catch (error) {
  await client.query('rollback');
  console.error(`Import failed, nothing was written: ${error.message}`);
  process.exit(1);
}

const { rows } = await client.query(
  `select count(*)::int as present from users where id = any($1::text[])`,
  [users.map((user) => user.id)],
);
const settings = await client.query(
  "select count(*)::int as n from app_settings where key = 'session_secret'",
);
const total = await client.query('select count(*)::int as n from users');
await client.end();

console.log(`read ${users.length} accounts from ${path.join(dir, 'users.json')}`);
console.log(`added ${added} new, left ${skipped} already present untouched`);
console.log(`users table now holds ${total.rows[0].n} accounts`);
console.log(
  settings.rows[0].n
    ? 'session secret is in the database (existing cookies keep working)'
    : 'WARNING: no session secret was imported',
);

if (rows[0].present !== users.length) {
  console.error('Some accounts from the file are missing from the database.');
  process.exit(1);
}
