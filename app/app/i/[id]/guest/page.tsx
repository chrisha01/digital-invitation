import Link from 'next/link';
import { notFound } from 'next/navigation';
import GuestView from '@/components/GuestView';
import { canManage } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { guestFacing } from '@/lib/guest-view';
import { getInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AppGuestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, inv] = await Promise.all([
    requireUser(`/app/i/${id}/guest`),
    getInvitation(id),
  ]);
  if (!inv || !canManage(inv, user)) notFound();

  return (
    <div className="m-guest">
      <Link href={`/app/i/${inv.id}`} className="m-guest-back">
        ‹ Invitation
      </Link>
      <GuestView
        inv={guestFacing(inv, null)}
        viewer={{ guest: null, name: null, token: null, passSvg: null }}
      />
    </div>
  );
}
