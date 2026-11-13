import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { Client } from 'pg';

/**
 * Removes objects in the bucket that no invitation references — images uploaded
 * and then abandoned, or left behind by an older client.
 *
 * Dry run unless --delete is passed. Anything modified within the grace window is
 * kept, so a sweep cannot race an upload that is still being saved.
 */

const flag = (name, fallback) => {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};

const bucket = process.env.S3_BUCKET?.trim();
const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
const connectionString = process.env.DATABASE_URL?.trim();

if (!bucket || !publicBase || !connectionString) {
  console.error('Needs S3_BUCKET, S3_PUBLIC_BASE_URL and DATABASE_URL in .env.');
  process.exit(1);
}

const graceHours = Number(flag('older-than-hours', '24'));
const shouldDelete = process.argv.includes('--delete');
const graceLabel = `${graceHours}h`;

const keyOf = (url) => {
  if (!url.startsWith(`${publicBase}/`)) return null;
  const key = url.slice(publicBase.length + 1).split('?')[0];
  return key ? decodeURIComponent(key) : null;
};

const db = new Client({ connectionString });
await db.connect();
const { rows } = await db.query(`
  select distinct url from (
    select document->'card'->>'photo' as url from invitations
    union all select document->'card'->>'portrait' from invitations
    union all select document->'backdrop'->>'image' from invitations
  ) urls where url is not null
`);
await db.end();

const referenced = new Set();
for (const row of rows) {
  const key = keyOf(row.url);
  if (key) referenced.add(key);
}

const s3 = new S3Client({
  region: process.env.S3_REGION?.trim() || (endpoint ? 'auto' : 'us-east-1'),
  endpoint,
  forcePathStyle: Boolean(endpoint),
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID?.trim(),
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY?.trim(),
  },
});

const objects = [];
let token;
do {
  const page = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: 'invitations/', ContinuationToken: token }),
  );
  for (const entry of page.Contents ?? []) {
    if (entry.Key) objects.push({ key: entry.Key, at: entry.LastModified ?? new Date(0) });
  }
  token = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (token);

const cutoff = Date.now() - graceHours * 60 * 60 * 1000;
const orphans = objects.filter((object) => !referenced.has(object.key) && object.at.getTime() < cutoff);

console.log(`bucket: ${objects.length} objects under invitations/, ${referenced.size} referenced`);
console.log(`orphans older than ${graceLabel}: ${orphans.length}`);

if (!orphans.length) process.exit(0);
for (const orphan of orphans) {
  console.log(`  ${orphan.key}  (${orphan.at.toISOString()})`);
}

if (!shouldDelete) {
  console.log('dry run: pass --delete to remove these');
  process.exit(0);
}

let removed = 0;
for (const orphan of orphans) {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: orphan.key }));
    removed += 1;
  } catch (error) {
    console.error(`could not delete ${orphan.key}: ${error.message}`);
  }
}
console.log(`deleted ${removed} of ${orphans.length}`);
process.exit(removed === orphans.length ? 0 : 1);
