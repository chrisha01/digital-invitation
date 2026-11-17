import { notFound } from 'next/navigation';
import AppCardEditor from '@/components/app/AppCardEditor';
import { canManage } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { getInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AppEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, inv] = await Promise.all([requireUser(`/app/i/${id}/edit`), getInvitation(id)]);
  if (!inv || !canManage(inv, user)) notFound();

  return <AppCardEditor initial={inv} />;
}
