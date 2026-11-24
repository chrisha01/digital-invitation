import { createHmac, timingSafeEqual } from 'node:crypto';
import { PLAN_CURRENCY, PLAN_PRICES, planKey, type PlanKey } from './plan-caps';

/**
 * The checkout half of the plan gate.
 *
 * Prices stay in lib/plan-caps.ts so the price list, the checkout and the cap
 * cannot drift apart; what lives here is the part that talks to Stripe: whether
 * this build is configured, how a webhook signature is checked, and which
 * checkout sessions are allowed to raise an account's plan.
 */

/** A paid Checkout Session this build is willing to act on. */
export type PaidCheckout = {
  sessionId: string;
  userId: string;
  plan: PlanKey;
  /** In the currency's minor unit, as Stripe counts it. */
  amount: number;
  currency: string;
};

/** Stripe has what a checkout and a verified delivery both need. */
export function checkoutConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

/**
 * Reads a completed Checkout Session and returns null for anything this build
 * must not act on: another event, an unpaid session, a plan nobody sells, an
 * amount that is not the price code charges, or no account to credit.
 *
 * The session arrives over a signature-checked delivery, but the price is
 * checked too: a price edited in the Stripe dashboard must not silently turn
 * into a different plan here.
 */
export function readPaidCheckout(event: unknown): PaidCheckout | null {
  const payload = event as { type?: string; data?: { object?: unknown } } | null;
  if (!payload || payload.type !== 'checkout.session.completed') return null;

  const session = (payload.data?.object ?? null) as {
    id?: string;
    payment_status?: string;
    amount_total?: number | null;
    currency?: string | null;
    client_reference_id?: string | null;
    metadata?: Record<string, string> | null;
  } | null;
  if (!session || !session.id) return null;
  if (session.payment_status !== 'paid') return null;

  const currency = (session.currency ?? '').toLowerCase();
  if (currency !== PLAN_CURRENCY) return null;

  const plan = planKey(session.metadata?.plan);
  if (PLAN_PRICES[plan] <= 0) return null;

  const userId = session.metadata?.user_id || session.client_reference_id || '';
  if (!userId) return null;

  // Both are set when the session was created; if they disagree, trust neither.
  if (session.metadata?.user_id && session.client_reference_id) {
    if (session.metadata.user_id !== session.client_reference_id) return null;
  }

  const amount = Number(session.amount_total);
  if (!Number.isFinite(amount) || amount !== PLAN_PRICES[plan]) return null;

  return { sessionId: session.id, userId, plan, amount, currency };
}

/**
 * Stripe's `Stripe-Signature` header: `t=<unix>,v1=<hex>` (a retry may add more
 * than one v1). The signature is an HMAC of `<t>.<payload>` under the endpoint's
 * signing secret, and the timestamp is checked so a captured delivery cannot be
 * replayed later.
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
  now = Date.now(),
): boolean {
  if (!header || !secret) return false;

  let timestamp = '';
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, ...rest] = part.split('=');
    const value = rest.join('=').trim();
    if (key.trim() === 't') timestamp = value;
    if (key.trim() === 'v1') signatures.push(value);
  }
  if (!/^\d+$/.test(timestamp) || signatures.length === 0) return false;

  // A clock far from Stripe's rejects its own deliveries, so allow both ways.
  if (Math.abs(now / 1000 - Number(timestamp)) > toleranceSeconds) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  const left = Buffer.from(expected);

  return signatures.some((signature) => {
    const right = Buffer.from(signature);
    return left.length === right.length && timingSafeEqual(left, right);
  });
}
