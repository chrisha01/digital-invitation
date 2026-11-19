import Link from 'next/link';
import SiteShell from '@/components/SiteShell';

export default function RootNotFound() {
  return (
    <SiteShell>
      <section className="lost">
        <p className="hero-eyebrow">404 — page not found</p>
        <h1>This page went out in the wrong post.</h1>
        <p className="hero-sub">
          The link you followed doesn’t lead anywhere on Gatherly. It may be out of date, or the
          invitation behind it is gone.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary btn-large" href="/">
            Back to the front page
          </Link>
          <Link className="btn btn-ghost btn-large" href="/create">
            Start an invitation
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
