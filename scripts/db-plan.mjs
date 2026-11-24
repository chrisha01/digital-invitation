/**
 * Puts an account on a plan. There is no checkout, so this is how a larger plan
 * is granted: `npm run db:plan -- you@example.com letter`.
 *
 * The keys are the ones lib/plan-caps.ts and the users_plan_check constraint
 * know; tests/pricing.test.ts keeps those two in step.
 */
import { Client } from 'pg';

const KEYS = ['note', 'letter', 'suite'];
const [email, plan] = process.argv.slice(2);

if (!email || !plan || !KEYS.includes(plan)) {
  console.error('usage: npm run db:plan -- <email> <note|letter|suite>');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error('DATABASE_URL is not set. Put your Postgres connection string in .env first.');
  process.exit(1);
}

const client = new Client({ connectionString });
await client.connect();

try {
  const { rows } = await client.query(
    'update users set plan = $2 where email = $1 returning email, plan',
    [email.trim().toLowerCase(), plan],
  );
  if (!rows[0]) {
    console.error(`No account with the email ${email}.`);
    process.exit(1);
  }
  console.log(`${rows[0].email} is on the ${rows[0].plan} plan.`);
} finally {
  await client.end();
}
