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
  const user = await requireUser();
  const { id, design } = await searchParams;

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
