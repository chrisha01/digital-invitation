'use client';

import Link from 'next/link';
import SiteShell from '@/components/SiteShell';

export default function RootError() {
  return (
    <SiteShell>
      <section className="lost">
        <p className="hero-eyebrow">Something went wrong</p>
        <h1>The post got lost on the way.</h1>
        <p className="hero-sub">
          This page couldn’t be put together just now. It’s usually temporary — try again, or head
          back to the front page and start from there.
        </p>
        <div className="hero-actions">
          {/* reset() re-renders from the data that already failed; a reload asks
              the server for the page again, which is what a retry needs. */}
          <button
            type="button"
            className="btn btn-primary btn-large"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
          <Link className="btn btn-ghost btn-large" href="/">
            Back to the front page
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
