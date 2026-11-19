import Link from 'next/link';

// One shape for "this did not work out" inside the app: a way back, the reason,
// and one obvious next step. Not-found and error pages differ only in words.
export default function AppPanel({
  title,
  reason,
  panelTitle,
  note,
  children,
}: {
  title: string;
  reason: string;
  panelTitle: string;
  note: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="m-page">
      <Link href="/app" className="m-back">
        ‹ Invitations
      </Link>

      <header className="m-head">
        <h1 className="m-title">{title}</h1>
        <p className="m-sub">{reason}</p>
      </header>

      <div className="m-empty">
        <h2>{panelTitle}</h2>
        <p>{note}</p>
        {children ?? (
          <Link className="btn btn-primary" href="/app">
            Back to invitations
          </Link>
        )}
      </div>
    </main>
  );
}
