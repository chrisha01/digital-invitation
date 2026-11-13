/**
 * Keeps the orphan-image sweep running: posts to the job endpoint now, then on
 * every interval. It lives outside the Next build on purpose — an in-process
 * timer forced Next to compile the database code for the edge runtime, and a
 * second process is also the honest shape for a scheduled job on a host that
 * may restart the app.
 *
 *   SWEEP_INTERVAL_MINUTES=1440 npm run scheduler
 */

const base = (process.env.APP_URL ?? 'http://127.0.0.1:3210').replace(/\/+$/, '');
const secret = process.env.CRON_SECRET?.trim();
const minutes = Number(process.env.SWEEP_INTERVAL_MINUTES ?? '0');
const graceHours = Number(process.env.SWEEP_GRACE_HOURS ?? '24');

if (!secret) {
  console.error('CRON_SECRET is not set. Add it to .env so the job endpoint can authenticate this.');
  process.exit(1);
}
if (!Number.isFinite(minutes) || minutes <= 0) {
  console.error('Set SWEEP_INTERVAL_MINUTES to a number above 0 (1440 = daily).');
  process.exit(1);
}

async function run() {
  try {
    const response = await fetch(`${base}/api/jobs/sweep-images`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ delete: true, graceHours }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`[sweep] ${response.status}: ${data.error ?? response.statusText}`);
      return;
    }

    console.log(
      `[sweep] listed ${data.listed}, referenced ${data.referenced}, deleted ${data.deleted.length} of ${data.orphans.length} orphan(s)`,
    );
    for (const key of data.deleted) console.log(`  deleted ${key}`);
    for (const failure of data.failed) console.error(`  failed ${failure.key}: ${failure.error}`);
  } catch (error) {
    console.error(`[sweep] request failed: ${error instanceof Error ? error.message : error}`);
  }
}

await run();
setInterval(run, minutes * 60_000);
console.log(`[sweep] running every ${minutes} minute(s) against ${base}`);
