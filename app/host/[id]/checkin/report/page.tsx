import { notFound } from 'next/navigation';
import CheckInReport from '@/components/CheckInReport';
import { canManage } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { getInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function CheckInReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, invitation] = await Promise.all([
    requireUser(`/host/${id}/checkin/report`),
    getInvitation(id),
  ]);
  if (!invitation || !canManage(invitation, user)) notFound();
  return <CheckInReport inv={invitation} />;
}
