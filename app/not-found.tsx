import Link from 'next/link';
import BrandMark from '@/components/BrandMark';

export default function RootNotFound() {
  return (
    <div className="home">
      <header className="home-nav">
        <Link href="/" className="brand">
          <BrandMark />
        </Link>
        <nav className="home-links">
          <Link href="/#designs">Designs</Link>
          <Link href="/#how">How it works</Link>
          <Link className="btn btn-primary" href="/create">
            Start an invitation
          </Link>
        </nav>
      </header>

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

      <footer className="home-footer">
        <span className="brand">
          <BrandMark />
        </span>
        <span className="muted small">
          An original design study of the online-stationery workflow. Not affiliated with any
          stationery company.
        </span>
      </footer>
    </div>
  );
}
