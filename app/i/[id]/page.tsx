import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import GuestView from '@/components/GuestView';
import Loading from '@/components/Loading';
import { passCode } from '@/lib/checkin';
import { guestFacing } from '@/lib/guest-view';
import { guestToken, verifyGuestToken } from '@/lib/guest-token';
import { getInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

type Invitation = NonNullable<Awaited<ReturnType<typeof getInvitation>>>;

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ g?: string; t?: string }>;
}) {
  const { id } = await params;
  const { g, t } = await searchParams;
  // The card has to exist before anything streams, or a missing link would be
  // answered with a 200 shell instead of a real 404.
  const invitation = await getInvitation(id);
  if (!invitation) notFound();

  return (
    <Suspense fallback={<Loading />}>
      <GuestCard invitation={invitation} id={id} g={g} t={t} />
    </Suspense>
  );
}

async function GuestCard({
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
