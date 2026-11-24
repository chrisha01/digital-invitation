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
