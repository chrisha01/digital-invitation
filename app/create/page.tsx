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

  // Viewing this page writes nothing: the invitation is created by the button,
  // so a prefetch, a refresh or a return here cannot leave duplicates behind.
  return (
    <main className="m-page">
      <header className="m-head">
        <h1 className="m-title">Start an invitation</h1>
        <p className="m-sub">The card opens in the editor, where every word and colour is yours.</p>
      </header>

      <div className="m-panel">
        <h2>{design ? 'Your chosen design' : 'A new card'}</h2>
        <p>Nothing is sent until you share it, so start whenever you are ready.</p>
        <StartInvitation design={design} hrefPrefix="/create?id=">
          Start the card
        </StartInvitation>
      </div>
    </main>
  );
}
