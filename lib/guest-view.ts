import { guestHeads } from './checkin';
import { findSeat } from './seating';
import type { Guest, Invitation } from './types';

/**
 * Everything a guest page is allowed to know about an invitation.
 *
 * The stored document carries every guest's email, phone, dietary notes,
 * accessibility needs and private message. A client component's props are
 * serialised into the page it renders, so the guest page must be handed this
 * projection — never the document. Adding a field here is a deliberate act;
 * forgetting one fails quietly, which is why the type is explicit rather than
 * `Partial<Invitation>`.
 */
export type GuestFacingInvitation = Pick<
  Invitation,
  | 'id'
  | 'designSlug'
  | 'title'
  | 'card'
  | 'envelope'
  | 'backdrop'
  | 'event'
  | 'settings'
  | 'page'
  | 'blocks'
> & {
  /** Confirmed names, and only when the host chose to show the guest list. */
  guestNames: string[];
  /** Heads expected, for the "N guests in all" line. */
  headcount: number;
  /** This guest's plus-ones, as the reply form prefills them. */
  companions: string[];
  /** The final seating assignment, reduced to what the guest is told. */
  seat: { tableName: string; chair: number } | null;
};

/**
 * Who is looking at the guest page, and how much that is worth. A signed
 * personal link sets `guest` and earns a pass; an older unsigned link only
 * knows the name to print, and a bare invitation link has neither.
 */
export type GuestPageViewer = {
  guest: Guest | null;
  name: string | null;
  /** Signature to send back with a reply; null unless the link proved it. */
  token: string | null;
  /** This guest's entry pass, which only a signed link can show. */
  passSvg: string | null;
  /** A link named a guest whose signature no longer verifies, or who is gone. */
  linkExpired: boolean;
};

export function guestFacing(
  invitation: Invitation,
  guest: Guest | null,
): GuestFacingInvitation {
  const confirmed = invitation.guests.filter((row) => row.status === 'yes');
  const seat =
    guest && invitation.seating?.finalized ? findSeat(invitation.seating, guest.id) : null;

  return {
    id: invitation.id,
    designSlug: invitation.designSlug,
    title: invitation.title,
    card: invitation.card,
    envelope: invitation.envelope,
    backdrop: invitation.backdrop,
    event: invitation.event,
    settings: invitation.settings,
    page: invitation.page,
    blocks: invitation.blocks,
    guestNames: invitation.settings.showGuestList ? confirmed.map((row) => row.name) : [],
    headcount: confirmed.reduce((sum, row) => sum + guestHeads(row), 0),
    companions: guest
      ? invitation.guests
          .filter((row) => row.companionOf === guest.id)
          // A placeholder name is not an answer; leave that field empty for it.
          .map((row) => (row.name.startsWith('Guest of ') ? '' : row.name))
      : [],
    seat: seat ? { tableName: seat.table.name, chair: seat.chair } : null,
  };
}
