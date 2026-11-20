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
 * personal link sets `guest` and earns a pass. A link that names a guest but
 * cannot prove it sets neither: the id alone is not evidence, so no name is
 * printed and the page explains the link is out of date.
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

/**
 * Where the guest page should point an image.
 *
 * Without object storage a picture is kept in the document as a base64 data
 * URL. Sent as-is it travels twice — once in the rendered card, once in the
 * serialised props — so a 500 kB photo made a 1.4 MB page. Pointing at a route
 * keeps the document off the page entirely and lets the browser cache the
 * picture, keyed by the version this invitation last saved.
 */
function imageSource(
  invitationId: string,
  updatedAt: string | undefined,
  value: string | null | undefined,
  slot: 'photo' | 'portrait' | 'backdrop',
): string | null {
  if (!value) return null;
  if (!value.startsWith('data:')) return value;
  const version = encodeURIComponent(updatedAt ?? '');
  return `/api/invitations/${encodeURIComponent(invitationId)}/photo/${slot}?v=${version}`;
}

export function guestFacing(
  invitation: Invitation,
  guest: Guest | null,
): GuestFacingInvitation {
  const confirmed = invitation.guests.filter((row) => row.status === 'yes');
  const seat =
    guest && invitation.seating?.finalized ? findSeat(invitation.seating, guest.id) : null;
  const photo = imageSource(invitation.id, invitation.updatedAt, invitation.card.photo, 'photo');
  const portrait = imageSource(
    invitation.id,
    invitation.updatedAt,
    invitation.card.portrait ?? null,
    'portrait',
  );
  const backdropImage = imageSource(
    invitation.id,
    invitation.updatedAt,
    invitation.backdrop?.image ?? null,
    'backdrop',
  );

  return {
    id: invitation.id,
    designSlug: invitation.designSlug,
    title: invitation.title,
    card: { ...invitation.card, photo, portrait },
    envelope: invitation.envelope,
    backdrop: { ...invitation.backdrop, image: backdropImage },
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
