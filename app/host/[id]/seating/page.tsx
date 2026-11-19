import { notFound } from 'next/navigation';
import SeatingPlanEditor from '@/components/SeatingPlanEditor';
import { canManage } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { getInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function SeatingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, invitation] = await Promise.all([
    requireUser(`/host/${id}/seating`),
    getInvitation(id),
  ]);
  if (!invitation || !canManage(invitation, user)) notFound();
  return <SeatingPlanEditor inv={invitation} />;
}
