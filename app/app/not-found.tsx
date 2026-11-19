import Link from 'next/link';
import AppTabs from '@/components/app/AppTabs';

export default function AppNotFound() {
  return (
    <div className="m-notfound">
      <main className="m-page">
        <Link href="/app" className="m-back">
          ‹ Invitations
        </Link>

        <header className="m-head">
          <h1 className="m-title">This invitation isn’t here</h1>
          <p className="m-sub">The link may be out of date, or the invitation was deleted.</p>
        </header>

        <div className="m-empty">
          <h2>Nothing to open</h2>
          <p>Your other invitations are still waiting for you.</p>
          <Link className="btn btn-primary" href="/app">
            Back to invitations
          </Link>
        </div>
      </main>

      <AppTabs always />
    </div>
  );
}
