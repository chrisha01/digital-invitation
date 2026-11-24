import type { PaidCheckout } from './billing';
import { getPool } from './db';
import { planRank } from './plan-caps';

/**
 * What happened to a delivery.
 *
 * - `upgraded`  — first delivery of a payment that raised the plan
 * - `recorded`  — first delivery of a payment the account already covers
 * - `duplicate` — Stripe retried a session that is already in `purchases`
 * - `unknown-user` — the account is gone, so no receipt is kept
 */
export type PurchaseOutcome = 'upgraded' | 'recorded' | 'duplicate' | 'unknown-user';

/**
 * Writes the payment and raises the account's plan in one transaction.
 *
 * The account is read and locked first: a delivery for an account that no
 * longer exists must not leave a receipt pointing at nothing. The session id is
 * unique, so a retried delivery is answered with `duplicate` instead of
 * upgrading twice, and the plan only moves up, so a late delivery can never
 * undo a larger plan bought since.
 */
export async function recordPurchase(purchase: PaidCheckout): Promise<PurchaseOutcome> {
  const client = await getPool().connect();
  try {
    await client.query('begin');

    const { rows } = await client.query<{ plan: string }>(
      'select plan from users where id = $1 for update',
      [purchase.userId],
    );
    if (!rows[0]) {
      await client.query('rollback');
      return 'unknown-user';
    }

    const inserted = await client.query(
      `insert into purchases (id, user_id, plan, amount, currency, provider, session_id)
       values ($1, $2, $3, $4, $5, 'stripe', $6)
       on conflict (session_id) do nothing
       returning id`,
      [
        `pur_${purchase.sessionId}`,
        purchase.userId,
        purchase.plan,
        purchase.amount,
        purchase.currency,
        purchase.sessionId,
      ],
    );
    if (!inserted.rowCount) {
      await client.query('rollback');
      return 'duplicate';
    }

    if (planRank(rows[0].plan) >= planRank(purchase.plan)) {
      await client.query('commit');
      return 'recorded';
    }

    await client.query('update users set plan = $2 where id = $1', [purchase.userId, purchase.plan]);
    await client.query('commit');
    return 'upgraded';
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
