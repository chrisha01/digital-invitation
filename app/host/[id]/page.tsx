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
  // Fire and forget so the dashboard renders at once, but never leave the promise
  // unhandled: a failed send must not surface as a server error.
  void runDueReminders(stored, origin).catch(() => undefined);
  const sms = smsSetup();
  const email = emailSetup();
  return (
    <HostDashboard
      inv={stored}
      sms={{ configured: Boolean(sms.provider), missing: sms.missing }}
      mail={{ configured: Boolean(email.provider), missing: email.missing }}
      role={isOwner(stored, user) ? 'owner' : 'collaborator'}
    />
  );
}
