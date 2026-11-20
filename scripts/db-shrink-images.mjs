import { Client } from 'pg';

/**
 * Re-encodes pictures already inlined in invitation documents to the size the
 * editor now stores them at, so old invitations load as light as new ones.
 *
 * The editor shrinks a photo in the browser before uploading (lib/upload-image.ts:
 * 1800px on the long edge, JPEG at 0.82, files under 450 kB left alone). Anything
 * saved before that existed still carries whatever the camera produced, and that
 * whole document is read by the editor and by the guest page's photo route. This
 * does the same job on the server, once.
 *
 * It is a little stricter than the upload path, because it only ever runs once
 * and nobody is waiting on it: 1400px on the long edge (still more than twice the
 * size a card ever draws a portrait at) and the highest quality whose result fits
 * a 300 kB budget. Re-encoding at the upload path's own 1800px/0.82 can come out
 * *bigger* than an already well-compressed phone photo, which would defeat the
 * point, so quality steps down until the picture is actually light.
 *
 *   npm run db:shrink-images             rewrite what is too heavy
 *   npm run db:shrink-images -- --dry-run  report only
 *
 * A rewritten image bumps the invitation's updatedAt, which is what the photo
 * route uses to version its URL; without it a browser would keep serving the old
 * bytes from its immutable cache. That does move the invitation to the top of the
 * dashboard's "recently edited" order.
 *
 * sharp is not a direct dependency: Next installs it as an optional dependency
 * for next/image, and it is already present wherever the app has been installed.
 */
const MAX_EDGE = 1400;
const SHRINK_ABOVE_BYTES = 450_000;
const BUDGET_BYTES = 300_000;
/** Tried in order; the first one inside the budget wins, the smallest is the floor. */
const QUALITIES = [82, 76, 72, 68];

const SLOTS = [
  { path: '{card,photo}', update: ['card', 'photo'] },
  { path: '{card,portrait}', update: ['card', 'portrait'] },
  { path: '{backdrop,image}', update: ['backdrop', 'image'] },
];

const dryRun = process.argv.includes('--dry-run');
const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error('DATABASE_URL is not set. Add your Postgres connection string to .env first.');
  process.exit(1);
}

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('sharp is not installed here; run `npm install` (Next brings it in) and try again.');
  process.exit(1);
}

const describe = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}`;
  } catch {
    return 'unreadable URL';
  }
};

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} kB`;

/** Decodes a data URL; anything else (an object-store URL) is not ours to touch. */
function decode(value) {
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(value ?? '');
  if (!match) return null;
  const [, type, base64, payload] = match;
  const bytes = base64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8');
  return { type, bytes };
}

/** A fresh pipeline per encode: sharp consumes the one it is given. */
function resized(original) {
  return sharp(original.bytes, { failOn: 'none' })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true });
}

/** mozjpeg is worth ~20% over the default encoder; a libvips without it still works. */
async function encodeJpeg(original, quality) {
  try {
    return await resized(original).jpeg({ quality, mozjpeg: true }).toBuffer();
  } catch {
    return await resized(original).jpeg({ quality }).toBuffer();
  }
}

/**
 * The same re-encode lib/upload-image.ts asks the browser for, tightened: fit
 * inside 1400px, JPEG unless the source was a PNG that may have transparency,
 * and step the quality down until the picture fits the budget. Returns null when
 * the picture is already light or the re-encode would not help.
 */
async function shrink(original) {
  if (original.type === 'image/gif' || original.type === 'image/svg+xml') return null;
  if (original.bytes.byteLength <= SHRINK_ABOVE_BYTES) return null;

  const meta = await sharp(original.bytes, { failOn: 'none' }).metadata();
  if (!meta.width || !meta.height) return null;
  const longest = Math.max(meta.width, meta.height);

  const png = original.type === 'image/png';
  let encoded;
  if (png) {
    encoded = await resized(original).png({ compressionLevel: 9 }).toBuffer();
  } else {
    for (const quality of QUALITIES) {
      const candidate = await encodeJpeg(original, quality);
      if (!encoded || candidate.byteLength < encoded.byteLength) encoded = candidate;
      if (candidate.byteLength <= BUDGET_BYTES) break;
    }
  }

  if (!encoded || encoded.byteLength >= original.bytes.byteLength) return null;
  return {
    type: png ? 'image/png' : 'image/jpeg',
    bytes: encoded,
    width: meta.width,
    height: meta.height,
    resized: longest > MAX_EDGE,
  };
}

const client = new Client({ connectionString });
await client.connect();

let scanned = 0;
let rewritten = 0;
let savedBytes = 0;

try {
  const { rows } = await client.query('select id, document, updated_at from invitations order by created_at');
  console.log(`checking ${rows.length} invitations in ${describe(connectionString)}${dryRun ? ' (dry run)' : ''}`);

  for (const row of rows) {
    const replacements = [];
    for (const slot of SLOTS) {
      const value = slot.update.reduce((node, key) => node?.[key], row.document);
      if (typeof value !== 'string') continue;
      scanned += 1;

      const original = decode(value);
      if (!original) continue;

      const result = await shrink(original);
      if (!result) continue;

      const after = `data:${result.type};base64,${result.bytes.toString('base64')}`;
      replacements.push({ ...slot, before: value, after, result, from: original.bytes.byteLength });
    }

    if (replacements.length === 0) {
      console.log(`  ${row.id}: nothing to do`);
      continue;
    }

    const updatedAt = dryRun ? null : new Date().toISOString();
    if (dryRun) {
      for (const item of replacements) {
        console.log(
          `  ${row.id} ${item.update.join('.')}: ${kb(item.from)} → ${kb(item.result.bytes.byteLength)}` +
            `${item.result.resized ? ` (${item.result.width}x${item.result.height} scaled to fit ${MAX_EDGE}px)` : ''}`,
        );
        savedBytes += item.from - item.result.bytes.byteLength;
        rewritten += 1;
      }
      continue;
    }

    await client.query('begin');
    try {
      for (const item of replacements) {
        // Only rewrite the row if the slot still holds exactly what we read.
        const { rowCount } = await client.query(
          `update invitations
              set document = jsonb_set(document, $2::text[], to_jsonb($3::text)),
                  updated_at = $4
            where id = $1
              and document #> $2::text[] = to_jsonb($5::text)`,
          [row.id, item.update, item.after, updatedAt, item.before],
        );
        if (rowCount !== 1) throw new Error(`${item.update.join('.')} changed while reading; try again`);
        console.log(
          `  ${row.id} ${item.update.join('.')}: ${kb(item.from)} → ${kb(item.result.bytes.byteLength)}`,
        );
        savedBytes += item.from - item.result.bytes.byteLength;
        rewritten += 1;
      }
      await client.query(
        `update invitations set document = jsonb_set(document, '{updatedAt}', to_jsonb($2::text)) where id = $1`,
        [row.id, updatedAt],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      console.error(`  ${row.id}: ${error.message}`);
    }
  }

  console.log(
    `${dryRun ? 'would rewrite' : 'rewrote'} ${rewritten} image(s) of ${scanned} inline slot(s), ` +
      `saving ${kb(savedBytes)}${dryRun ? ' (dry run)' : ''}`,
  );
} finally {
  await client.end();
}
