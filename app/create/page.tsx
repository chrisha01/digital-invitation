import { notFound, redirect } from 'next/navigation';
import Editor from '@/components/Editor';
import { canManage } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { buildInvitation } from '@/lib/defaults';
import { getInvitation, putInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; design?: string }>;
}) {
  const { id, design } = await searchParams;
  // Signing in again should land back on the invitation being edited, or on a
  // new one in the design that was picked. The default route creates a fresh
  // invitation, so a bare /create is a valid place to return to as well.
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

  const invitation = buildInvitation(design);
  invitation.ownerId = user.id;
  await putInvitation(invitation);
  redirect(`/create?id=${invitation.id}`);
}
