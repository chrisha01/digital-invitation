import type { Guest } from './types';

/** Two notes, kept in order and never repeated. */
function both(first?: string, second?: string): string | undefined {
  const a = (first ?? '').trim();
  const b = (second ?? '').trim();
  if (!a) return b || undefined;
  if (!b || b.toLowerCase() === a.toLowerCase()) return a;
  return `${a} · ${b}`;
}

/**
 * The row whose reply survives: any reply beats none, and between two replies
 * the later one wins, since that is the guest correcting themselves.
 */
function replyRow(into: Guest, from: Guest): Guest {
  if (into.status === 'invited') return from.status === 'invited' ? into : from;
  if (from.status === 'invited') return into;
  return (from.respondedAt ?? '') > (into.respondedAt ?? '') ? from : into;
}

/**
 * Folds one guest row into another, or null when the pair is not on the list.
 *
 * The kept row survives with its id, so its personal link and its chair still
 * name the right person; everything the other row holds is carried across.
 */
export function mergeGuests(guests: Guest[], fromId: string, intoId: string): Guest[] | null {
  const from = guests.find((guest) => guest.id === fromId);
  const into = guests.find((guest) => guest.id === intoId);
  if (!from || !into || from === into) return null;

  const reply = replyRow(into, from);

  // The kept row has the last word per question; a blank answer is a gap to fill.
  const answers: Record<string, string> = {};
  for (const key of new Set([...Object.keys(into.answers), ...Object.keys(from.answers)])) {
    const value = both(into.answers[key], from.answers[key]);
    if (value) answers[key] = value;
  }

  // Arriving is a one-off, so the earlier scan is the real time at the door.
  const firstCheckIn = [into, from]
    .filter((guest) => guest.checkedInAt)
    .sort((a, b) => String(a.checkedInAt).localeCompare(String(b.checkedInAt)))[0];

  // Consent belongs to the number that was kept, not to the row it came from.
  const phone = into.phone || from.phone || undefined;
  const smsConsent = phone ? Boolean(into.phone ? into.smsConsent : from.smsConsent) : undefined;

  const merged: Guest = {
    ...into,
    email: into.email || from.email,
    household: into.household || from.household,
    tag: into.tag || from.tag,
    status: reply.status,
    plusOnes: reply.plusOnes,
    adults: reply.adults,
    children: reply.children,
    answers,
    message: both(into.message, from.message) ?? '',
    dietary: both(into.dietary, from.dietary),
    accessibility: both(into.accessibility, from.accessibility),
    phone,
    smsConsent,
    respondedAt: reply.respondedAt ?? null,
    checkedInAt: firstCheckIn?.checkedInAt ?? null,
    checkedInBy: firstCheckIn?.checkedInBy,
  };

  return guests
    .filter((guest) => guest.id !== fromId)
    .map((guest) => {
      if (guest.id === intoId) return merged;
      // Plus-ones brought by the removed row follow the guest who remains.
      return guest.companionOf === fromId ? { ...guest, companionOf: intoId } : guest;
    });
}
