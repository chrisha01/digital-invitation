import Link from 'next/link';
import BrandMark from '../BrandMark';

/**
 * The host surfaces — dashboard, check-in, report, seating and the editor — all
 * wear the same top bar over the paper background. A link that no longer
 * resolves and a page that failed to load therefore use this one shape, so they
 * read as part of the dashboard instead of the marketing site. Deliberately
 * free of hooks so both the server not-found page and the client error
 * boundary can render it.
 */
export default function HostPanel({
  label,
  title,
  body,
  children,
}: {
  label: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="host-shell">
      <header className="topbar">
        <div className="topbar-left">
          <Link href="/app" className="brand">
            <BrandMark />
          </Link>
          <span className="crumb">/</span>
          <span className="host-title">{label}</span>
        </div>
        <div className="topbar-right">
          <Link className="btn btn-ghost" href="/app">
            All invitations
          </Link>
        </div>
      </header>

      <main className="host-main host-lost">
        <section className="host-card">
          <h1 className="host-lost-title">{title}</h1>
          <p className="host-lost-body">{body}</p>
          <div className="host-lost-actions">{children}</div>
        </section>
      </main>
    </div>
  );
}
