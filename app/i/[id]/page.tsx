import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import GuestView from '@/components/GuestView';
import { passCode } from '@/lib/checkin';
import { getInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ g?: string }>;
}) {
  const { id } = await params;
  const { g } = await searchParams;
  const invitation = await getInvitation(id);
  if (!invitation) notFound();

  const guest = g ? invitation.guests.find((candidate) => candidate.id === g) ?? null : null;

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
      inv={invitation}
      guest={guest}
      guestName={guest?.name ?? null}
      passSvg={passSvg}
    />
  );
}
