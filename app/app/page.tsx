import { Suspense } from 'react';
import Link from 'next/link';
import BrandMark from '@/components/BrandMark';
import Loading from '@/components/Loading';
import StartInvitation from '@/components/app/StartInvitation';
import { requireUser } from '@/lib/auth';
import { cachedInvitations } from '@/lib/invitation-cache';
import { formatWhen } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function AppHomePage() {
  const user = await requireUser('/app');

  return (
    <main className="m-page">
      <header className="m-head">
        <span className="brand m-brand">
          <BrandMark />
        </span>
        <h1 className="m-title">Your invitations</h1>
        <p className="m-sub">Signed in as {user.email}</p>
      </header>

      <Suspense fallback={<Loading />}>
        <InvitationList userId={user.id} />
      </Suspense>
    </main>
  );
}

async function InvitationList({ userId }: { userId: string }) {
  const saved = await cachedInvitations(userId);
  const now = Date.now();
  // Nearest first, then the archive newest-first — same order as the web home.
  const invitations = [...saved].sort((a, b) => {
    const at = new Date(a.startsAt).getTime() || 0;
    const bt = new Date(b.startsAt).getTime() || 0;
    const aUp = at >= now;
    const bUp = bt >= now;
    if (aUp !== bUp) return aUp ? -1 : 1;
    return aUp ? at - bt : bt - at;
  });

  if (invitations.length === 0) {
    return (
      <div className="m-empty">
        <h2>No invitations yet</h2>
        <p>Start one from a design and it will appear here, ready to send.</p>
        <StartInvitation>Start an invitation</StartInvitation>
      </div>
    );
  }

  return (
    <ul className="m-list">
      {invitations.map((item) => (
        <li key={item.id}>
          <Link href={`/app/i/${item.id}`} className="m-card">
            <span className="m-card-title">{item.title}</span>
            <span className="m-card-when">{formatWhen(item.startsAt)}</span>
            {item.location ? <span className="m-card-where">{item.location}</span> : null}
            <span className="m-counts">
              <span>{item.guestCount} guests</span>
              <span className="m-dot">·</span>
              <span>{item.yesCount} attending</span>
              {item.checkedIn ? (
                <>
                  <span className="m-dot">·</span>
                  <span>{item.checkedIn} checked in</span>
                </>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
