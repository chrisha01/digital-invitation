import { NextResponse } from 'next/server';
import { readPaidCheckout, verifyStripeSignature } from '@/lib/billing';
import { recordPurchase } from '@/lib/purchases';

export const dynamic = 'force-dynamic';

/**
 * Stripe's delivery of checkout events.
 *
 * The body is read as raw text and checked against the endpoint's signing
 * secret before it is parsed: an unsigned request must never be able to hand an
 * account a plan. Only `checkout.session.completed` for a paid session whose
 * amount matches PLAN_PRICES is acted on (lib/billing.ts).
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get('stripe-signature'), secret)) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 400 });
  }

  let event: unknown;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const paid = readPaidCheckout(event);
  if (!paid) {
    // Another event, an unpaid session or a price this build does not sell:
    // acknowledge it so Stripe stops retrying something there is nothing to do with.
    return NextResponse.json({ received: true, applied: false });
  }

  try {
    const outcome = await recordPurchase(paid);
    if (outcome === 'unknown-user') {
      console.error('stripe purchase for a missing account:', paid.userId);
    }
    return NextResponse.json({
      received: true,
      applied: outcome === 'upgraded' || outcome === 'recorded',
      outcome,
    });
  } catch (error) {
    // A failure is a 500 so Stripe retries; the unique session id makes the
    // retry safe even if the transaction partly happened.
    console.error('stripe purchase failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not record the payment' }, { status: 500 });
  }
}
