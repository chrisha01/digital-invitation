import Link from 'next/link';
import BrandMark from '@/components/BrandMark';

// The marketing frame: wordmark, the two anchors that matter, and the footer.
// Shared by the landing page's offshoots so a wrong turn still looks like us.
export default function SiteShell({ children }: { children: React.ReactNode }) {
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

      {children}

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
