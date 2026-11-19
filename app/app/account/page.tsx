import SignOutButton from '@/components/SignOutButton';
import { requireUser } from '@/lib/auth';
import { listInvitations } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AppAccountPage() {
  const user = await requireUser('/app/account');
  const saved = await listInvitations(user.id);

  return (
    <main className="m-page">
      <header className="m-head">
        <h1 className="m-title">Account</h1>
      </header>

      <div className="m-panel">
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        <p className="m-meta">{saved.length === 1 ? '1 invitation' : `${saved.length} invitations`}</p>
        {saved.length === 0 ? (
          <p className="filter-empty">
            No invitations yet. Start one from a design and it will show up in your list.
          </p>
        ) : null}
      </div>

      <div className="m-panel">
        <h2>Sign out</h2>
        <p>You will need to sign in again to see your invitations.</p>
        <SignOutButton next="/app" />
      </div>
    </main>
  );
}
