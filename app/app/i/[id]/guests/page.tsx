import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import AppGuestManager from '@/components/app/AppGuestManager';
import { canManage } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { guestTokens } from '@/lib/guest-token';
import { getInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AppGuestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, inv] = await Promise.all([requireUser(`/app/i/${id}/guests`), getInvitation(id)]);
  if (!inv || !canManage(inv, user)) notFound();

  // Personal links are signed by the server, so the client gets the tokens
  // alongside the guest rows instead of minting them itself.
  const guestLinks = await guestTokens(
    inv.id,
    inv.guests.map((guest) => guest.id),
  );
  const headerList = await headers();
  const host = headerList.get('host');
  const proto = headerList.get('x-forwarded-proto') ?? 'http';
  const origin = host ? `${proto}://${host}` : '';

  return <AppGuestManager initial={inv} guestLinks={guestLinks} origin={origin} />;
}
