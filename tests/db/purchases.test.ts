import { createHmac } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { POST as webhook } from '@/app/api/stripe/webhook/route';
import { getPool } from '@/lib/db';
import { PLAN_PRICES, type PlanKey } from '@/lib/plan-caps';
import { recordPurchase } from '@/lib/purchases';

/**
 * The checkout's money path, against a real Postgres: a payment is recorded
 * once, the plan only ever rises, and the public webhook changes nothing
 * without Stripe's signature.
 */

const connection = process.env.DATABASE_URL?.trim() ?? '';
const database = (() => {
  try {
    return new URL(connection).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();

if (!database.endsWith('_test')) {
  throw new Error(
    `Refusing to run the purchase tests against "${database || 'no database'}". ` +
      'Set DATABASE_URL to a database whose name ends in _test, apply db/migrations, and run again.',
  );
}

let counter = 0;

async function makeUser(plan: PlanKey): Promise<string> {
  counter += 1;
  const id = `user_buytest_${Date.now()}_${counter}`;
  const now = new Date().toISOString();
  await getPool().query(
    `insert into users (id, name, email, salt, hash, created_at, password_changed_at, plan)
     values ($1, $2, $3, 'salt', 'hash', $4, $4, $5)`,
    [id, 'Billing Test', `${id}@billing-test.invalid`, now, plan],
  );
  return id;
}

async function planOf(userId: string): Promise<string> {
  const { rows } = await getPool().query<{ plan: string }>('select plan from users where id = $1', [
    userId,
  ]);
  return rows[0]?.plan ?? 'missing';
}

async function receipts(userId: string): Promise<number> {
  const { rows } = await getPool().query<{ total: number }>(
    'select count(*)::int as total from purchases where user_id = $1',
    [userId],
  );
  return rows[0].total;
}

const purchase = (userId: string, sessionId: string, plan: PlanKey) => ({
  sessionId,
  userId,
  plan,
  amount: PLAN_PRICES[plan],
  currency: 'usd',
});

beforeEach(async () => {
  const pool = getPool();
  await pool.query("delete from purchases where user_id like 'user_buytest_%'");
  await pool.query("delete from users where id like 'user_buytest_%'");
});

afterAll(async () => {
  await getPool().end();
});

describe('recording a payment', () => {
  it('raises the plan and keeps a receipt', async () => {
    const userId = await makeUser('note');

    expect(await recordPurchase(purchase(userId, 'cs_buy_1', 'letter'))).toBe('upgraded');
    expect(await planOf(userId)).toBe('letter');
    expect(await receipts(userId)).toBe(1);

    // A store write drops the cached per-owner lists; the account page reads the
    // plan from the users row, so the next request already sees it.
    const again = await recordPurchase(purchase(userId, 'cs_buy_1', 'letter'));
    expect(again).toBe('duplicate');
    expect(await receipts(userId)).toBe(1);
    expect(await planOf(userId)).toBe('letter');
  });

  it('never lowers a plan that is already larger', async () => {
    const userId = await makeUser('suite');

    expect(await recordPurchase(purchase(userId, 'cs_buy_2', 'letter'))).toBe('recorded');
    expect(await planOf(userId)).toBe('suite');
    // The payment still has a receipt, even though it changed nothing.
    expect(await receipts(userId)).toBe(1);
  });

  it('keeps no receipt for an account that does not exist', async () => {
    const userId = 'user_buytest_missing';

    expect(await recordPurchase(purchase(userId, 'cs_buy_3', 'letter'))).toBe('unknown-user');
    expect(await receipts(userId)).toBe(0);
  });
});

describe("stripe's webhook", () => {
  const secret = 'whsec_db_test';

  function body(userId: string, sessionId: string, overrides: Record<string, unknown> = {}) {
    return JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          payment_status: 'paid',
          amount_total: PLAN_PRICES.suite,
          currency: 'usd',
          client_reference_id: userId,
          metadata: { user_id: userId, plan: 'suite' },
          ...overrides,
        },
      },
    });
  }

  function signed(payload: string, at = Math.floor(Date.now() / 1000)) {
    const signature = createHmac('sha256', secret).update(`${at}.${payload}`).digest('hex');
    return `t=${at},v1=${signature}`;
  }

  function call(payload: string, signature?: string) {
    return webhook(
      new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(signature ? { 'stripe-signature': signature } : {}),
        },
        body: payload,
      }),
    );
  }

  it('upgrades on a signed, paid session and nothing else', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const userId = await makeUser('note');
    const payload = body(userId, 'cs_buy_hook_1');

    const unsigned = await call(payload);
    expect(unsigned.status).toBe(400);
    expect(await planOf(userId)).toBe('note');

    const signature = signed(payload);
    // An edited body no longer matches the signature it arrived with.
    const tampered = await call(payload.replace('"paid"', '"unpaid"'), signature);
    expect(tampered.status).toBe(400);
    expect(await planOf(userId)).toBe('note');

    // Correctly signed but unpaid: acknowledged, and nothing is applied.
    const unpaid = body(userId, 'cs_buy_hook_unpaid', { payment_status: 'unpaid' });
    const unpaidResponse = await call(unpaid, signed(unpaid));
    expect(unpaidResponse.status).toBe(200);
    expect((await unpaidResponse.json()).applied).toBe(false);
    expect(await planOf(userId)).toBe('note');

    const accepted = await call(payload, signature);
    expect(accepted.status).toBe(200);
    expect((await accepted.json()).outcome).toBe('upgraded');
    expect(await planOf(userId)).toBe('suite');
  });

  it('acknowledges a delivery for another event without touching a plan', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const userId = await makeUser('note');
    const payload = JSON.stringify({
      type: 'customer.created',
      data: { object: { id: 'cus_1' } },
    });

    const response = await call(payload, signed(payload));
    expect(response.status).toBe(200);
    expect((await response.json()).applied).toBe(false);
    expect(await planOf(userId)).toBe('note');
  });

  it('refuses every delivery when the endpoint has no secret', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const userId = await makeUser('note');
    const payload = body(userId, 'cs_buy_hook_2');

    const response = await call(payload, signed(payload));
    expect(response.status).toBe(503);
    expect(await planOf(userId)).toBe('note');
  });
});
