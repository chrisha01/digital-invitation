import { notFound } from 'next/navigation';
import AppGuestManager from '@/components/app/AppGuestManager';
import { canManage } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { getInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AppGuestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, inv] = await Promise.all([requireUser(`/app/i/${id}/guests`), getInvitation(id)]);
  if (!inv || !canManage(inv, user)) notFound();

  return <AppGuestManager initial={inv} />;
}
