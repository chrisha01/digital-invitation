import type { Guest, Invitation } from './types';

/**
 * The reply rules, kept apart from the route that stores them.
 *
 * The endpoint needs Postgres, a rate limit and a request body; none of those
 * are part of the rules themselves. Everything here is a pure function of its
 * arguments, so the rules in REQUIREMENTS.md §4 can be checked without a server.
 */

/** Whole numbers inside a range; anything unusable becomes the minimum. */
export function clampCount(value: unknown, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

/** One head per attending guest: the people named, or the guest plus their plus-ones. */
export const partySize = (guest: Guest): number =>
  guest.status === 'yes' ? Math.max(1, guest.adults + guest.children, 1 + guest.plusOnes) : 0;

/** A decline or a maybe keeps no party, so a later yes cannot inherit stale counts. */
export function clearParty(guest: Guest): void {
  guest.plusOnes = 0;
  guest.adults = 0;
  guest.children = 0;
}

/**
 * Whose row a reply belongs to, strongest proof first:
 *
 *   1. the guest a signed personal link names;
 *   2. the one row carrying this email address — an ambiguous address matches
 *      nobody, since an invitation holds one row per person;
 *   3. a row the host started with a name and nothing else. Filling in an empty
 *      row is not overwriting anyone's data.
 *
 * A typed name on its own never claims a row: names are public, so matching on
 * one would let any link holder answer for somebody else.
 */
export function guestForReply(
  guests: Guest[],
  { name, email, signedId }: { name: string; email: string; signedId: string | null },
): Guest | undefined {
  if (signedId) {
    const signed = guests.find((row) => row.id === signedId);
    if (signed) return signed;
  }

  if (email) {
    const matches = guests.filter(
      (row) => row.email && row.email.toLowerCase() === email.toLowerCase(),
    );
    if (matches.length === 1) return matches[0];
  }

  const sameName = guests.filter(
    (row) =>
      row.name.trim().toLowerCase() === name.trim().toLowerCase() &&
      !row.email &&
      row.status === 'invited' &&
      !row.respondedAt,
  );
  return sameName.length === 1 ? sameName[0] : undefined;
}

/** Seats already committed, ignoring the replying row and the plus-ones it brought. */
export function seatsTaken(guests: Guest[], excludeGuestId: string): number {
  return guests
    .filter((candidate) => candidate.id !== excludeGuestId && candidate.companionOf !== excludeGuestId)
    .reduce((sum, candidate) => sum + partySize(candidate), 0);
}

/** Whether a party of this size still fits; no capacity set means no limit. */
export function fitsCapacity(invitation: Invitation, guestId: string, size: number): boolean {
  const capacity = invitation.settings.capacity;
  if (!capacity) return true;
  return seatsTaken(invitation.guests, guestId) + size <= capacity;
}

/** Why replies are not open right now, if they are not. */
export function rsvpClosedReason(
  invitation: Invitation,
  now = Date.now(),
): 'disabled' | 'deadline' | null {
  if (!invitation.settings.collectRsvp) return 'disabled';
  const deadline = invitation.settings.deadline;
  if (deadline && new Date(deadline).getTime() < now) return 'deadline';
  return null;
}
