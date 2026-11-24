/**
 * What a plan lets an account hold.
 *
 * Kept apart from lib/plans.ts, which is the price list and imports the whole
 * design catalogue to count it. Server code that enforces a cap only needs this
 * file, so a create route does not pull 41 designs into its bundle.
 */
export type PlanKey = 'note' | 'letter' | 'suite';

export const PLAN_KEYS = ['note', 'letter', 'suite'] as const;

/** Invitations an account on this plan may hold. The database stores the key only. */
export const PLAN_CAPS: Record<PlanKey, number> = {
  note: 1,
  letter: 3,
  suite: 10,
};

/** How the plan is written for a badge or an error message. */
export const PLAN_LABELS: Record<PlanKey, string> = {
  note: 'Note',
  letter: 'Letter',
  suite: 'Suite',
};

/**
 * A plan key read from the database. Anything unrecognised (an old row, a
 * missing column, a typo) falls back to the smallest plan, so the gate fails
 * closed rather than handing out an unlimited account.
 */
export function planKey(value: string | null | undefined): PlanKey {
  return PLAN_KEYS.includes(value as PlanKey) ? (value as PlanKey) : 'note';
}

/** The invitation cap this account's plan carries. */
export function planCap(value: string | null | undefined): number {
  return PLAN_CAPS[planKey(value)];
}

/**
 * What a plan costs, in pence.
 *
 * Prices live beside the caps because they are part of the same gate: the
 * checkout charges these numbers and the price list prints them, so a card
 * cannot advertise one price and take another. Zero is the free tier.
 */
export const PLAN_PRICES: Record<PlanKey, number> = {
  note: 0,
  letter: 2400,
  suite: 7900,
};

/** The currency Stripe is asked for; also the one a paid session must be in. */
export const PLAN_CURRENCY = 'gbp';

/** Position in the plan list. A purchase may only move an account up it. */
export function planRank(value: string | null | undefined): number {
  return PLAN_KEYS.indexOf(planKey(value));
}

/** £24, or £24.50 when a price is not a whole pound. */
export function money(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

/** The paid plans above this one: exactly what the account may buy. */
export function paidPlansAbove(value: string | null | undefined): PlanKey[] {
  const from = planRank(value);
  return PLAN_KEYS.filter((key) => PLAN_PRICES[key] > 0 && planRank(key) > from);
}
