/**
 * Triggers the sweep through the running app, so there is exactly one
 * implementation of the logic (lib/sweep-images.ts) and every run is logged to
 * job_runs like the scheduled ones.
 *
 *   npm run db:sweep-images                      dry run
 *   npm run db:sweep-images -- --delete           remove what it finds
 *   npm run db:sweep-images -- --delete --older-than-hours=0
 */

const flag = (name, fallback) => {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};

const base = (process.env.APP_URL ?? 'http://127.0.0.1:3210').replace(/\/+$/, '');
const secret = process.env.CRON_SECRET?.trim();

if (!secret) {
  console.error('CRON_SECRET is not set. Add it to .env (the job endpoint refuses to run without it).');
  process.exit(1);
}

const response = await fetch(`${base}/api/jobs/sweep-images`, {
  method: 'POST',
  headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    delete: process.argv.includes('--delete'),
    graceHours: Number(flag('older-than-hours', '24')),
  }),
});

const text = await response.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  console.error(`${response.status} ${response.statusText}: ${text.slice(0, 200)}`);
  process.exit(1);
}

if (!response.ok) {
  console.error(`${response.status}: ${data.error ?? text}`);
  process.exit(1);
}

console.log(`bucket: ${data.listed} objects under invitations/, ${data.referenced} referenced`);
console.log(`orphans older than ${data.graceHours}h: ${data.orphans.length}`);
for (const orphan of data.orphans) console.log(`  ${orphan.key}  (${orphan.lastModified})`);

if (data.dryRun) {
  console.log('dry run: pass --delete to remove these');
  process.exit(0);
}

console.log(`deleted ${data.deleted.length} of ${data.orphans.length}`);
for (const error of data.failed) console.error(`  failed: ${error.key}: ${error.error}`);
process.exit(data.failed.length ? 1 : 0);
