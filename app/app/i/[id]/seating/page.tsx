import { notFound } from 'next/navigation';
import AppSeatingPlan from '@/components/app/AppSeatingPlan';
import { canManage } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { getInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AppSeatingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, inv] = await Promise.all([requireUser(`/app/i/${id}/seating`), getInvitation(id)]);
  if (!inv || !canManage(inv, user)) notFound();

  return <AppSeatingPlan initial={inv} />;
}
