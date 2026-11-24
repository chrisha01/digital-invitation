import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPaidCheckout, readPaidCheckout, verifyStripeSignature } from '@/lib/billing';
import { PLAN_PRICES, money, paidPlansAbove, planRank } from '@/lib/plan-caps';
import { PLANS } from '@/lib/plans';

/**
 * The checkout's pure half: which plan a request may buy, what it costs, and
 * whether a delivery really came from Stripe. Nothing here talks to Stripe or
 * Postgres, so the rules are testable without either.
 */

const SECRET = 'whsec_test';
const NOW = 1_760_000_000_000; // a fixed clock so the tolerance is deterministic

const sign = (payload: string, timestamp = Math.floor(NOW / 1000), secret = SECRET) =>
  `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')}`;

function sessionObject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_test_123',
    payment_status: 'paid',
    amount_total: PLAN_PRICES.letter,
    currency: 'usd',
    client_reference_id: 'user_1',
    metadata: { user_id: 'user_1', plan: 'letter' },
    ...overrides,
  };
}

function paidSession(overrides: Record<string, unknown> = {}) {
  return {
    type: 'checkout.session.completed',
    data: { object: sessionObject(overrides) },
  };
}

describe('what a plan costs', () => {
  it('prints the same amount the price table charges', () => {
    expect(PLANS.map((plan) => plan.amount)).toEqual([
      money(PLAN_PRICES.note),
      money(PLAN_PRICES.letter),
      money(PLAN_PRICES.suite),
    ]);
    expect(money(PLAN_PRICES.letter)).toBe('$24');
  });

  it('writes cents as dollars, including the cents that are not zero', () => {
    expect(money(0)).toBe('$0');
    expect(money(2400)).toBe('$24');
    expect(money(2450)).toBe('$24.50');
  });

  it('ranks the plans and offers only the ones above the current one', () => {
    expect(planRank('note')).toBeLessThan(planRank('letter'));
    expect(planRank('letter')).toBeLessThan(planRank('suite'));

    expect(paidPlansAbove('note')).toEqual(['letter', 'suite']);
    expect(paidPlansAbove('letter')).toEqual(['suite']);
    expect(paidPlansAbove('suite')).toEqual([]);
    // An unknown plan fails closed to the smallest one, so it can buy the rest.
    expect(paidPlansAbove('legend')).toEqual(['letter', 'suite']);
  });
});

describe("stripe's signature", () => {
  const payload = JSON.stringify({ hello: 'world' });

  it('accepts a delivery signed with the endpoint secret', () => {
    expect(verifyStripeSignature(payload, sign(payload), SECRET, 300, NOW)).toBe(true);
  });

  it('accepts a header that carries more than one signature', () => {
    const good = sign(payload);
    const other = createHmac('sha256', 'whsec_other').update(
      `${Math.floor(NOW / 1000)}.${payload}`,
    ).digest('hex');
    const header = `${good},v1=${other}`;
    expect(verifyStripeSignature(payload, header, SECRET, 300, NOW)).toBe(true);
  });

  it('rejects another secret, a tampered body and a missing header', () => {
    expect(verifyStripeSignature(payload, sign(payload, undefined, 'whsec_wrong'), SECRET, 300, NOW)).toBe(
      false,
    );
    expect(verifyStripeSignature(`${payload} `, sign(payload), SECRET, 300, NOW)).toBe(false);
    expect(verifyStripeSignature(payload, null, SECRET, 300, NOW)).toBe(false);
    expect(verifyStripeSignature(payload, 'v1=abc', SECRET, 300, NOW)).toBe(false);
  });

  it('rejects a captured delivery replayed after the tolerance', () => {
    const old = Math.floor(NOW / 1000) - 600;
    expect(verifyStripeSignature(payload, sign(payload, old), SECRET, 300, NOW)).toBe(false);
    // The same delivery inside the window is still fine.
    expect(verifyStripeSignature(payload, sign(payload, old), SECRET, 900, NOW)).toBe(true);
  });
});

describe('a paid checkout session', () => {
  it('reads the account, plan and amount from a paid session', () => {
    expect(readPaidCheckout(paidSession())).toEqual({
      sessionId: 'cs_test_123',
      userId: 'user_1',
      plan: 'letter',
      amount: PLAN_PRICES.letter,
      currency: 'usd',
    });
  });

  it('ignores every event it must not act on', () => {
    // Another event type.
    expect(readPaidCheckout({ ...paidSession(), type: 'payment_intent.succeeded' })).toBeNull();
    // Not paid yet.
    expect(readPaidCheckout(paidSession({ payment_status: 'unpaid' }))).toBeNull();
    // The free plan is not for sale.
    expect(
      readPaidCheckout(
        paidSession({ amount_total: 0, metadata: { user_id: 'user_1', plan: 'note' } }),
      ),
    ).toBeNull();
    // An amount the price table does not charge.
    expect(readPaidCheckout(paidSession({ amount_total: 100 }))).toBeNull();
    // Stripe charged in a currency this build does not sell in.
    expect(readPaidCheckout(paidSession({ currency: 'gbp' }))).toBeNull();
    // Nothing says which account to credit.
    expect(
      readPaidCheckout(
        paidSession({ client_reference_id: null, metadata: { plan: 'letter' } }),
      ),
    ).toBeNull();
    // The metadata and the reference disagree.
    expect(
      readPaidCheckout(
        paidSession({ client_reference_id: 'user_2', metadata: { user_id: 'user_1', plan: 'letter' } }),
      ),
    ).toBeNull();
  });
});

describe('the session a buyer comes back with', () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });

  /** Stands in for Stripe, and records what was asked of it. */
  function stubStripe(answer: () => Response) {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return answer();
    });
    return calls;
  }

  it('asks stripe for the paid session and reads it', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_key';
    const calls = stubStripe(() => new Response(JSON.stringify(sessionObject()), { status: 200 }));

    expect(await fetchPaidCheckout('cs_test_123')).toEqual({
      sessionId: 'cs_test_123',
      userId: 'user_1',
      plan: 'letter',
      amount: PLAN_PRICES.letter,
      currency: 'usd',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.stripe.com/v1/checkout/sessions/cs_test_123');
    expect((calls[0].init?.headers as Record<string, string>).authorization).toBe(
      'Bearer sk_test_key',
    );
  });

  it('does not ask stripe about an id that is not a session, or without a key', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_key';
    const calls = stubStripe(() => new Response('{}', { status: 200 }));

    expect(await fetchPaidCheckout('not-a-session')).toBeNull();
    expect(await fetchPaidCheckout(undefined)).toBeNull();
    expect(calls).toHaveLength(0);

    delete process.env.STRIPE_SECRET_KEY;
    expect(await fetchPaidCheckout('cs_test_123')).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('ignores an unpaid session, another amount and a failure from stripe', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_key';
    vi.spyOn(console, 'error').mockImplementation(() => {});

    stubStripe(
      () => new Response(JSON.stringify(sessionObject({ payment_status: 'unpaid' })), { status: 200 }),
    );
    expect(await fetchPaidCheckout('cs_test_123')).toBeNull();

    stubStripe(() => new Response(JSON.stringify(sessionObject({ amount_total: 1 })), { status: 200 }));
    expect(await fetchPaidCheckout('cs_test_123')).toBeNull();

    stubStripe(() => new Response('{"error":"nope"}', { status: 401 }));
    expect(await fetchPaidCheckout('cs_test_123')).toBeNull();
  });
});
