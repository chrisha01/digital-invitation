import { Suspense } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import HostDashboard from '@/components/HostDashboard';
import Loading from '@/components/Loading';
import { canManage, isOwner } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { emailSetup } from '@/lib/email';
import { guestTokens } from '@/lib/guest-token';
import { runDueReminders } from '@/lib/reminders';
import { smsSetup } from '@/lib/sms';
import { getInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

type Invitation = NonNullable<Awaited<ReturnType<typeof getInvitation>>>;

export default async function HostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The session check and the invitation fetch do not depend on each other, so
  // they run together instead of one round trip after the other.
  const [user, stored] = await Promise.all([requireUser(), getInvitation(id)]);
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

  return (
    <Suspense fallback={<Loading />}>
      <HostBoard
        stored={stored}
        origin={origin}
        role={isOwner(stored, user) ? 'owner' : 'collaborator'}
      />
    </Suspense>
  );
}

async function HostBoard({
  stored,
  origin,
  role,
}: {
  stored: Invitation;
  origin: string;
  role: 'owner' | 'collaborator';
}) {
  const sms = smsSetup();
  const email = emailSetup();
  // Personal links are signed, so the dashboard needs the signatures for the
  // guests it can copy links for.
  const guestLinks = await guestTokens(
    stored.id,
    stored.guests.map((guest) => guest.id),
  );
  return (
    <HostDashboard
      inv={stored}
      guestLinks={guestLinks}
      sms={{ configured: Boolean(sms.provider), missing: sms.missing }}
      mail={{ configured: Boolean(email.provider), missing: email.missing }}
      role={role}
    />
  );
}
