import QRCode from 'qrcode';
import GuestView from '@/components/GuestView';
import { passCode } from '@/lib/checkin';
import { guestFacing } from '@/lib/guest-view';
import { guestToken, verifyGuestToken } from '@/lib/guest-token';
import type { Invitation } from '@/lib/types';

/**
 * The guest card for one invitation, with whatever its link proves.
 *
 * Kept out of page.tsx so the route tests can read the viewer this resolves
 * without rendering the client card; a page may only export its own entry
 * points, and Next type-checks that.
 */
export async function GuestCard({
  invitation,
  id,
  g,
  t,
}: {
  invitation: Invitation;
  id: string;
  g?: string;
  t?: string;
}) {
  // A personal link made before links were signed still knows whose it is, so it
  // gets the name on the envelope and nothing more: no pass, no prefilled reply,
  // no contact details, and no way to claim that row when replying.
  const linked = g ? invitation.guests.find((candidate) => candidate.id === g) ?? null : null;
  const guest = linked && (await verifyGuestToken(id, linked.id, t)) ? linked : null;

  // The door team scans this pass; the code also works typed in by hand.
  let passSvg: string | null = null;
  if (guest) {
    try {
      passSvg = await QRCode.toString(passCode(invitation.id, guest.id), {
        type: 'svg',
        margin: 1,
        width: 220,
        errorCorrectionLevel: 'M',
        color: { dark: '#1a1a1a', light: '#ffffff' },
      });
    } catch {
      passSvg = null;
    }
  }

  return (
    <GuestView
      inv={guestFacing(invitation, guest)}
      viewer={{
        guest,
        // A name taken from an unproved id is not printed anywhere: the page
        // says the link is out of date instead.
        name: guest?.name ?? null,
        token: guest ? await guestToken(id, guest.id) : null,
        passSvg,
        // A personal link that names a guest but cannot prove it: a signature
        // from before a secret change, or a name since removed from the list.
        linkExpired: Boolean(g) && !guest,
      }}
    />
  );
}
