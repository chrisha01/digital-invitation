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
 * must not act on: an unpaid session, a plan nobody sells, an amount that is not
 * the price code charges, or no account to credit.
 *
 * The session arrives over a signature-checked delivery, or is fetched from
 * Stripe by session id on the way back from Checkout, but the price is checked
 * either way: a price edited in the Stripe dashboard must not silently turn
 * into a different plan here.
 */
export function readPaidSession(session: unknown): PaidCheckout | null {
  const paid = (session ?? null) as {
    id?: string;
    payment_status?: string;
    amount_total?: number | null;
    currency?: string | null;
    client_reference_id?: string | null;
    metadata?: Record<string, string> | null;
  } | null;
  if (!paid || !paid.id) return null;
  if (paid.payment_status !== 'paid') return null;

  const currency = (paid.currency ?? '').toLowerCase();
  if (currency !== PLAN_CURRENCY) return null;

  const plan = planKey(paid.metadata?.plan);
  if (PLAN_PRICES[plan] <= 0) return null;

  const userId = paid.metadata?.user_id || paid.client_reference_id || '';
  if (!userId) return null;

  // Both are set when the session was created; if they disagree, trust neither.
  if (paid.metadata?.user_id && paid.client_reference_id) {
    if (paid.metadata.user_id !== paid.client_reference_id) return null;
  }

  const amount = Number(paid.amount_total);
  if (!Number.isFinite(amount) || amount !== PLAN_PRICES[plan]) return null;

  return { sessionId: paid.id, userId, plan, amount, currency };
}

/** The webhook's shape: the session it acted on, wrapped in an event. */
export function readPaidCheckout(event: unknown): PaidCheckout | null {
  const payload = event as { type?: string; data?: { object?: unknown } } | null;
  if (!payload || payload.type !== 'checkout.session.completed') return null;
  return readPaidSession(payload.data?.object);
}

/** What a Checkout Session id looks like. Anything else is not worth a request. */
const SESSION_ID = /^cs_[A-Za-z0-9_]+$/;

/**
 * Reads one session straight from Stripe, for the buyer coming back from
 * Checkout.
 *
 * Stripe's webhook is the source of truth, but it can arrive after the browser
 * is already back, so the return page asks Stripe what it just paid for instead
 * of showing the plan the account held before. Returns null when checkout is not
 * configured, the id is not a session id, or Stripe does not describe a paid
 * session this build sells.
 */
export async function fetchPaidCheckout(sessionId: string | null | undefined): Promise<PaidCheckout | null> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  const id = sessionId?.trim() ?? '';
  if (!key || !SESSION_ID.test(id)) return null;

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`,
      {
        headers: { authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      },
    );
    if (!response.ok) {
      console.error('stripe session lookup failed:', response.status);
      return null;
    }
    return readPaidSession(await response.json());
  } catch (error) {
    console.error('stripe session lookup failed:', error instanceof Error ? error.message : error);
    return null;
  }
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
