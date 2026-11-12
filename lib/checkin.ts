import type { Guest, Invitation } from './types';

/** One head per attending party, counting adults, children and unnamed plus-ones. */
export const guestHeads = (guest: Guest) =>
  guest.status === 'yes' ? Math.max(1, guest.adults + guest.children, 1 + guest.plusOnes) : 0;

export function checkInCounts(invitation: Invitation) {
  const expected = invitation.guests.reduce((sum, guest) => sum + guestHeads(guest), 0);
  const checkedIn = invitation.guests
    .filter((guest) => guest.checkedInAt)
    .reduce((sum, guest) => sum + Math.max(1, guestHeads(guest)), 0);
  return {
    expected,
    checkedIn,
    remaining: Math.max(0, expected - checkedIn),
    rows: invitation.guests.filter((guest) => guest.checkedInAt).length,
  };
}

export const passCode = (invitationId: string, guestId: string) =>
  `GATHERLY:${invitationId}:${guestId}`;

/** A QR carries `GATHERLY:<invitation>:<guest>`; the manual field takes the guest id. */
export function readCheckInCode(raw: string, invitationId: string): string | null {
  const code = raw.trim().slice(0, 300);
  if (!code) return null;
  if (code.toUpperCase().startsWith('GATHERLY:')) {
    const [, invitation, guest] = code.split(':');
    if (invitation !== invitationId || !guest) return null;
    return guest;
  }
  // A guest may scan the invitation link from their own phone instead.
  try {
    const url = new URL(code);
    const guest = url.searchParams.get('g');
    if (guest) return guest;
  } catch {
    // Not a URL — fall through to a plain guest id.
  }
  return code;
}
