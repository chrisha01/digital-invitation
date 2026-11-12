import { notFound } from 'next/navigation';
import HostDashboard from '@/components/HostDashboard';
import { canManage, isOwner } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { emailSetup } from '@/lib/email';
import { smsSetup } from '@/lib/sms';
import { getInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function HostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const invitation = await getInvitation(id);
  if (!invitation || !canManage(invitation, user)) notFound();
  const sms = smsSetup();
  const email = emailSetup();
  return (
    <HostDashboard
      inv={invitation}
      sms={{ configured: Boolean(sms.provider), missing: sms.missing }}
      mail={{ configured: Boolean(email.provider), missing: email.missing }}
      role={isOwner(invitation, user) ? 'owner' : 'collaborator'}
    />
  );
}
