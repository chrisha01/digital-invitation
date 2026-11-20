import { readFile, writeFile } from 'node:fs/promises';

/**
 * Switches the single active DATABASE_URL line in .env between the bundled
 * Postgres and whatever Neon connection string the file remembers. The Neon URL
 * is kept in a commented `# NEON_DATABASE_URL=` line, so switching back and forth
 * never loses it and re-running either direction changes nothing.
 */
const LOCAL_URL =
  process.env.LOCAL_DATABASE_URL?.trim() || 'postgresql://postgres@127.0.0.1:5544/gatherly';

const target = process.argv[2];
if (target !== 'local' && target !== 'neon') {
  console.error('usage: npm run db:use:local  |  npm run db:use:neon');
  process.exit(1);
}

const file = '.env';
let text;
try {
  text = await readFile(file, 'utf8');
} catch {
  console.error(`No ${file} in ${process.cwd()}. Copy your settings into one first.`);
  process.exit(1);
}

const nl = text.includes('\r\n') ? '\r\n' : '\n';
const lines = text.split(/\r?\n/);
const isActive = (line) => /^\s*DATABASE_URL\s*=/.test(line);
const isNeon = (line) => /^\s*#\s*NEON_DATABASE_URL\s*=/.test(line);
const valueOf = (line) => line.slice(line.indexOf('=') + 1).trim();

const activeIndex = lines.findIndex(isActive);
const neonIndex = lines.findIndex(isNeon);
const active = activeIndex === -1 ? null : valueOf(lines[activeIndex]);

let neon = neonIndex === -1 ? null : valueOf(lines[neonIndex]);
// A remote URL sitting in the active line is the Neon string we should remember.
if (!neon && active && active !== LOCAL_URL) neon = active;

if (target === 'neon' && !neon) {
  console.error(
    'No Neon connection string is saved. Add a line to .env and run this again:\n' +
      '  # NEON_DATABASE_URL=postgresql://…neon.tech/neondb?sslmode=verify-full',
  );
  process.exit(1);
}

const desired = target === 'local' ? LOCAL_URL : neon;
const next = [];
let placed = false;

for (let index = 0; index < lines.length; index += 1) {
  if (index === activeIndex || index === neonIndex) {
    if (!placed) {
      placed = true;
      next.push(`DATABASE_URL=${desired}`);
      // Keep the Neon string as a comment only while it is not the active line.
      if (target === 'local' && neon) next.push(`# NEON_DATABASE_URL=${neon}`);
    }
    continue;
  }
  next.push(lines[index]);
}

if (!placed) {
  if (next.length && next[next.length - 1] === '') next.splice(next.length - 1, 0, '');
  next.push(`DATABASE_URL=${desired}`);
  if (target === 'local' && neon) next.push(`# NEON_DATABASE_URL=${neon}`);
  if (!next[next.length - 1]) next.push('');
}

const updated = next.join(nl);
if (updated !== text) await writeFile(file, updated);

// Never echo credentials: scheme and host are enough to say which one is live.
const describe = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}`;
  } catch {
    return 'unreadable URL';
  }
};

const changed = updated !== text;
console.log(`Database: ${target === 'neon' ? 'Neon' : 'local'} (${describe(desired)})`);
console.log(changed ? `Wrote ${file}. Restart the server to pick it up.` : `${file} already pointed there.`);
if (target === 'neon') console.log(`The local URL is still in .env as LOCAL_DATABASE_URL default: ${describe(LOCAL_URL)}`);
