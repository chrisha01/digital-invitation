import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { checkoutConfigured } from '@/lib/billing';
import {
  PLAN_CAPS,
  PLAN_CURRENCY,
  PLAN_LABELS,
  PLAN_PRICES,
  paidPlansAbove,
  planKey,
} from '@/lib/plan-caps';
import { rateGate } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Where Stripe sends the buyer back to. APP_URL wins so a proxied deployment
 * returns to its public origin; in development the request's own origin is used.
 */
function appOrigin(request: Request): string {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const gate = await rateGate(request, 'checkout', 10, 60_000);
  if (!gate.ok) return gate.response;

  if (!checkoutConfigured()) {
    return NextResponse.json(
      {
        error:
          'Checkout is not switched on for this build yet, so plans are granted by hand.',
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as { plan?: string } | null;
  const plan = planKey(body?.plan);

  // Only a paid plan above the account's own. A request cannot buy the free
  // plan, cannot re-buy the plan it holds, and cannot name a key nobody sells.
  if (!paidPlansAbove(user.plan).includes(plan)) {
    return NextResponse.json(
      {
        error: `The ${PLAN_LABELS[planKey(user.plan)]} plan does not sell that.`,
      },
      { status: 409 },
    );
  }

  const origin = appOrigin(request);
  const price = PLAN_PRICES[plan];

  // The amount comes from PLAN_PRICES, never from the request: the browser picks
  // a plan key, and the server decides what that costs.
  const form = new URLSearchParams({
    mode: 'payment',
    success_url: `${origin}/app/account?paid=1`,
    cancel_url: `${origin}/app/account?cancelled=1`,
    client_reference_id: user.id,
    customer_email: user.email,
    'metadata[user_id]': user.id,
    'metadata[plan]': plan,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': PLAN_CURRENCY,
    'line_items[0][price_data][unit_amount]': String(price),
    'line_items[0][price_data][product_data][name]': `Gatherly ${PLAN_LABELS[plan]} plan`,
    'line_items[0][price_data][product_data][description]': `Holds ${PLAN_CAPS[plan]} invitations at a time. Paid once.`,
  });

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.STRIPE_SECRET_KEY?.trim()}`,
        'content-type': 'application/x-www-form-urlencoded',
        // Two taps from one buyer in the same ten minutes reuse one session
        // rather than piling up open checkouts for the same plan.
        'idempotency-key': `${user.id}:${plan}:${Math.floor(Date.now() / 600_000)}`,
      },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });

    const created = (await response.json().catch(() => null)) as {
      url?: string;
      error?: { message?: string };
    } | null;

    if (!response.ok || !created?.url) {
      console.error('stripe checkout failed:', response.status, created?.error?.message ?? 'no url');
      return NextResponse.json(
        { error: 'Checkout could not start. Try again in a moment.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: created.url });
  } catch (error) {
    console.error('stripe checkout failed:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Checkout could not start. Try again in a moment.' },
      { status: 502 },
    );
  }
}
