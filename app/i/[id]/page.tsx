import { notFound } from 'next/navigation';
import GuestView from '@/components/GuestView';
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

  return (
    <GuestView
      inv={invitation}
      guest={guest}
      guestName={guest?.name ?? null}
    />
  );
}
