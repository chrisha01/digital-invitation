import { forgetUser } from './auth';
import { fetchPaidCheckout } from './billing';
import { recordPurchase, type PurchaseOutcome } from './purchases';

/**
 * The buyer's way back from Checkout.
 *
 * The webhook stays the source of truth, but it can land after the browser is
 * home, and the page must not offer the plan that was just paid for. So the
 * return page asks Stripe about the session in its own URL and records it
 * through the same idempotent path: whichever of the two arrives first keeps the
 * receipt, the other is answered as a duplicate.
 *
 * Only a session that names the signed-in account is acted on, so a session id
 * pasted into a URL can never credit somebody else's account or hand this
 * account a plan it did not pay for.
 *
 * Returns null when there is nothing to confirm: another account's session, an
 * unpaid one, a price this build does not sell, or checkout unconfigured.
 */
export async function confirmCheckoutReturn(
  sessionId: string | null | undefined,
  userId: string,
): Promise<PurchaseOutcome | null> {
  const paid = await fetchPaidCheckout(sessionId);
  if (!paid || paid.userId !== userId) return null;

  let outcome: PurchaseOutcome;
  try {
    outcome = await recordPurchase(paid);
  } catch (error) {
    // The buyer should still see their receipt rather than an error page; the
    // webhook is retried by Stripe and will record the same session.
    console.error(
      'confirming a checkout on return failed:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }

  // The row was cached before this payment; the page reads the plan again.
  forgetUser(userId);
  return outcome;
}
