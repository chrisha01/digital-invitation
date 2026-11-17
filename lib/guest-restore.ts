import type { Guest, RsvpStatus } from './types';

const STATUSES: RsvpStatus[] = ['invited', 'yes', 'no', 'maybe'];

/** Whole-number party counts from a copy the dashboard kept. */
function count(value: unknown) {
  return Math.max(0, Math.min(50, Math.floor(Number(value) || 0)));
}

function text(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

/**
 * Rebuilds a guest row from a copy the dashboard kept for its undo offer,
 * trusting none of it. Notes are allowed to run past a single edit's limit,
 * because a merged row can hold the notes from two rows.
 */
export function guestFromCopy(input: Partial<Guest> | undefined): Guest | null {
  if (!input || typeof input !== 'object') return null;
  const id = text(input.id, 80);
  const name = text(input.name, 120);
  if (!id || !name) return null;

  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.answers ?? {})) {
    if (typeof value === 'string' && value) answers[key.slice(0, 80)] = value.slice(0, 500);
  }

  const guest: Guest = {
    id,
    name,
    email: text(input.email, 200),
    household: text(input.household, 80),
    tag: text(input.tag, 60) || 'Friends',
    status: STATUSES.includes(input.status as RsvpStatus) ? (input.status as RsvpStatus) : 'invited',
    plusOnes: count(input.plusOnes),
    adults: count(input.adults),
    children: count(input.children),
    answers,
    message: String(input.message ?? '').slice(0, 8000),
    respondedAt: typeof input.respondedAt === 'string' ? input.respondedAt : null,
  };
  if (input.dietary) guest.dietary = String(input.dietary).slice(0, 2000);
  if (input.accessibility) guest.accessibility = String(input.accessibility).slice(0, 2000);
  if (input.phone) guest.phone = text(input.phone, 40);
  if (typeof input.smsConsent === 'boolean') guest.smsConsent = input.smsConsent;
  if (input.companionOf) guest.companionOf = String(input.companionOf).slice(0, 80);
  if (input.checkedInAt) guest.checkedInAt = String(input.checkedInAt);
  if (input.checkedInBy) guest.checkedInBy = String(input.checkedInBy).slice(0, 120);
  return guest;
}
