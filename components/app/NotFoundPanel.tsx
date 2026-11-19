import Link from 'next/link';

// One shape for "this is not here" inside the app: a way back, the reason, and
// one obvious next step. Both not-found pages differ only in their words.
export default function NotFoundPanel({
  title,
  reason,
  note,
}: {
  title: string;
  reason: string;
  note: string;
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
        <h2>Nothing to open</h2>
        <p>{note}</p>
        <Link className="btn btn-primary" href="/app">
          Back to invitations
        </Link>
      </div>
    </main>
  );
}
