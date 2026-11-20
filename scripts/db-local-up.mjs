import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

/**
 * Runs before `npm run dev`: brings the bundled Postgres up if nothing is
 * listening on its port. It never blocks a dev start that is pointed somewhere
 * else — a checkout without .localdb just gets a note and carries on.
 */
const ROOT = process.cwd();
const BIN = path.join(ROOT, '.localdb', 'pgsql', 'bin');
const DATA = path.join(ROOT, '.localdb', 'data');
const LOG = path.join(ROOT, '.localdb', 'postgres.log');
const HOST = '127.0.0.1';
const PORT = Number(process.env.LOCAL_PG_PORT || 5544);

const reachable = () =>
  new Promise((resolve) => {
    const socket = net.connect({ host: HOST, port: PORT });
    const finish = (up) => {
      socket.destroy();
      resolve(up);
    };
    socket.setTimeout(800, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });

const tail = async (chars = 600) => {
  try {
    const log = await readFile(LOG, 'utf8');
    return log.trim().split(/\r?\n/).slice(-6).join('\n') || `(empty ${LOG})`;
  } catch {
    return `(no ${LOG} yet)`;
  }
};

if (await reachable()) {
  console.log(`local Postgres already listening on ${HOST}:${PORT}`);
  process.exit(0);
}

const pgCtl = path.join(BIN, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
try {
  await access(pgCtl);
  await access(path.join(DATA, 'PG_VERSION'));
} catch {
  console.log('No bundled local Postgres in .localdb — dev will use DATABASE_URL from .env as it is.');
  process.exit(0);
}

console.log(`starting local Postgres on ${HOST}:${PORT} …`);
const child = spawn(
  pgCtl,
  ['-D', DATA, '-o', `-p ${PORT} -c listen_addresses=${HOST}`, '-l', LOG, 'start'],
  { detached: true, stdio: 'ignore', windowsHide: true },
);
child.unref();

const deadline = Date.now() + 30_000;
while (Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (await reachable()) {
    console.log(`local Postgres is up on ${HOST}:${PORT} (log: .localdb/postgres.log)`);
    process.exit(0);
  }
}

console.error(`local Postgres did not accept connections on ${HOST}:${PORT} within 30s. Last log lines:`);
console.error(await tail());
process.exit(1);
