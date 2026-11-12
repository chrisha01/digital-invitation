import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import HostDashboard from '@/components/HostDashboard';
import { canManage, isOwner } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { emailSetup } from '@/lib/email';
import { runDueReminders } from '@/lib/reminders';
import { smsSetup } from '@/lib/sms';
import { getInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function HostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const stored = await getInvitation(id);
  if (!stored || !canManage(stored, user)) notFound();

  // There is no scheduler in this app, so reminders that came due are sent when
  // a host next opens the dashboard.
  const headerList = await headers();
  const host = headerList.get('host');
  const proto = headerList.get('x-forwarded-proto') ?? 'http';
  const origin = host ? `${proto}://${host}` : '';
  const invitation = await runDueReminders(stored, origin);

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
