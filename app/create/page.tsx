import { notFound } from 'next/navigation';
import Editor from '@/components/Editor';
import StartInvitation from '@/components/app/StartInvitation';
import { canManage } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { getInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; design?: string }>;
}) {
  const { id, design } = await searchParams;
  // Signing in again should land back on the invitation being edited, or on a
  // new one in the design that was picked.
  const next = id
    ? `/create?id=${encodeURIComponent(id)}`
    : design
      ? `/create?design=${encodeURIComponent(design)}`
      : '/create';
  const user = await requireUser(next);

  if (id) {
    const existing = await getInvitation(id);
    if (!existing || !canManage(existing, user)) notFound();
    return <Editor initial={existing} />;
  }

  // Starting is a click, not a side effect of viewing this page: rendering a GET
  // used to insert an invitation, so a prefetch, a refresh or a second click
  // left duplicates behind.
  return (
    <main className="m-page">
      <header className="m-head">
        <h1 className="m-title">Start an invitation</h1>
        <p className="m-sub">The card opens in the editor, where every word and colour is yours.</p>
      </header>

      <div className="m-panel">
        <h2>{design ? 'Your chosen design' : 'A new card'}</h2>
        <p>Starting creates the invitation and opens it straight away. Nothing is sent until you share it.</p>
        <StartInvitation design={design} destination="editor" busyLabel="Starting…">
          Start the card
        </StartInvitation>
      </div>
    </main>
  );
}
