import { NextResponse } from 'next/server';
import { canManage, isOwner } from '@/lib/access';
import { currentUser } from '@/lib/auth';
import { discardImages, imageUrls } from '@/lib/images';
import { deleteInvitation, getInvitation, mutateInvitation } from '@/lib/store';
import type { Invitation } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** The sections a design save may change, and the only ones it may change. */
const EDITABLE = [
  'title',
  'subject',
  'designSlug',
  'card',
  'envelope',
  'backdrop',
  'event',
  'settings',
  'page',
  'blocks',
] as const;

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await ctx.params;
  const invitation = await getInvitation(id);
  if (!invitation || !canManage(invitation, user)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ invitation });
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await ctx.params;
  const existing = await getInvitation(id);
  if (!existing || !canManage(existing, user)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Partial<Invitation> | null;
  if (!body || typeof body !== 'object' || body.id !== id) {
    return NextResponse.json({ error: 'Invalid invitation payload' }, { status: 400 });
  }
  if (!body.card || !Array.isArray(body.card.layers) || !body.event || !body.settings || !body.page) {
    return NextResponse.json({ error: 'Invitation payload is missing sections' }, { status: 400 });
  }

  const before = imageUrls(existing);

  // The read, the merge and the write happen inside one locked transaction: the
  // editor autosaves the document it loaded, so a reply that arrives mid-edit
  // must be merged into rather than overwritten by that older copy.
  const updated = await mutateInvitation(id, (current) => {
    const draft = current as unknown as Record<string, unknown>;
    for (const section of EDITABLE) {
      const value = (body as Record<string, unknown>)[section];
      if (value !== undefined) draft[section] = value;
    }
    // Guests, replies, ownership, co-host access, send history and the seating
    // plan belong to their own endpoints; a design save never touches them.
  });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // A replaced photo leaves an object behind; remove it once the save is stored.
  const after = imageUrls(updated);
  await discardImages(before.filter((url) => !after.includes(url)));
  return NextResponse.json({ invitation: updated });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await ctx.params;
  const existing = await getInvitation(id);
  if (!existing || !isOwner(existing, user)) {
    return NextResponse.json({ error: 'Only the owner can delete this invitation.' }, { status: 403 });
  }
  const removed = imageUrls(existing);
  await deleteInvitation(id);
  // Deleting the row first means the reference check cannot see this invitation.
  await discardImages(removed);
  return NextResponse.json({ ok: true });
}
