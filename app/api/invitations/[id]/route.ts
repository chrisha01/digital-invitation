import { NextResponse } from 'next/server';
import { canManage, isOwner } from '@/lib/access';
import { currentUser } from '@/lib/auth';
import { deleteInvitation, getInvitation, putInvitation } from '@/lib/store';
import type { Invitation } from '@/lib/types';

export const dynamic = 'force-dynamic';

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

  const next: Invitation = {
    ...existing,
    ...body,
    id,
    // Guests and their replies are owned by the RSVP endpoints, never by a design save.
    guests: existing.guests,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await putInvitation(next);
  return NextResponse.json({ invitation: next });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await ctx.params;
  const existing = await getInvitation(id);
  if (!existing || !isOwner(existing, user)) {
    return NextResponse.json({ error: 'Only the owner can delete this invitation.' }, { status: 403 });
  }
  await deleteInvitation(id);
  return NextResponse.json({ ok: true });
}
