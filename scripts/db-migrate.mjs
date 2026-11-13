import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error('DATABASE_URL is not set. Add your Neon connection string to .env first.');
  process.exit(1);
}

const dir = path.join(process.cwd(), 'db', 'migrations');
const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();

const client = new Client({ connectionString });
await client.connect();

try {
  await client.query(`
    create table if not exists schema_migrations (
      version    text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const applied = new Set(
    (await client.query('select version from schema_migrations')).rows.map((row) => row.version),
  );

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`- ${file} (already applied)`);
      continue;
    }
    const sql = await readFile(path.join(dir, file), 'utf8');
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into schema_migrations (version) values ($1)', [file]);
      await client.query('commit');
      console.log(`+ ${file}`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }
} finally {
  await client.end();
}
