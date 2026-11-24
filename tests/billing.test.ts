import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readPaidCheckout, verifyStripeSignature } from '@/lib/billing';
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

function paidSession(overrides: Record<string, unknown> = {}) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        payment_status: 'paid',
        amount_total: PLAN_PRICES.letter,
        currency: 'gbp',
        client_reference_id: 'user_1',
        metadata: { user_id: 'user_1', plan: 'letter' },
        ...overrides,
      },
    },
  };
}

describe('what a plan costs', () => {
  it('prints the same amount the price table charges', () => {
    expect(PLANS.map((plan) => plan.amount)).toEqual([
      money(PLAN_PRICES.note),
      money(PLAN_PRICES.letter),
      money(PLAN_PRICES.suite),
    ]);
    expect(money(PLAN_PRICES.letter)).toBe('£24');
  });

  it('writes pence as pounds, including the pence that are not zero', () => {
    expect(money(0)).toBe('£0');
    expect(money(2400)).toBe('£24');
    expect(money(2450)).toBe('£24.50');
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
      currency: 'gbp',
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
    expect(readPaidCheckout(paidSession({ currency: 'usd' }))).toBeNull();
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
