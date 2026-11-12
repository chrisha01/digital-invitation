import { NextResponse } from 'next/server';
import { canManage } from '@/lib/access';
import { currentUser } from '@/lib/auth';
import { newId } from '@/lib/defaults';
import { getInvitation, mutateInvitation } from '@/lib/store';
import type { Guest, Invitation, RsvpStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUSES: RsvpStatus[] = ['invited', 'yes', 'no', 'maybe'];

/** The guest list belongs to the invitation's owner, never to a guest link. */
async function owns(id: string): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  const invitation = await getInvitation(id);
  return Boolean(invitation && canManage(invitation, user));
}

async function respond(id: string, mutate: (invitation: Invitation) => void) {
  const updated = await mutateInvitation(id, mutate);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ guests: updated.guests });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!(await owns(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await request.json().catch(() => null)) as
    | { name?: string; email?: string; tag?: string }
    | null;
  const name = (body?.name ?? '').trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: 'A guest needs a name.' }, { status: 400 });

  return respond(id, (invitation) => {
    const guest: Guest = {
      id: newId('guest'),
      name,
      email: (body?.email ?? '').trim().slice(0, 200),
      tag: (body?.tag ?? '').trim().slice(0, 60),
      status: 'invited',
      plusOnes: 0,
      adults: 0,
      children: 0,
      answers: {},
      message: '',
      respondedAt: null,
    };
    invitation.guests.push(guest);
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!(await owns(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await request.json().catch(() => null)) as
    | { guestId?: string; patch?: Partial<Guest> }
    | null;
  if (!body?.guestId) return NextResponse.json({ error: 'Missing guest' }, { status: 400 });

  return respond(id, (invitation) => {
    const guest = invitation.guests.find((candidate) => candidate.id === body.guestId);
    if (!guest) return;
    const patch = body.patch ?? {};
    if (patch.status && STATUSES.includes(patch.status)) {
      guest.status = patch.status;
      guest.respondedAt = new Date().toISOString();
      if (patch.status !== 'yes') {
        guest.plusOnes = 0;
        guest.adults = 0;
        guest.children = 0;
      }
    }
    if (typeof patch.name === 'string') guest.name = patch.name.slice(0, 120);
    if (typeof patch.email === 'string') guest.email = patch.email.slice(0, 200);
    if (typeof patch.tag === 'string') guest.tag = patch.tag.slice(0, 60);
  });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!(await owns(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const guestId = new URL(request.url).searchParams.get('guestId');
  if (!guestId) return NextResponse.json({ error: 'Missing guest' }, { status: 400 });

  return respond(id, (invitation) => {
    invitation.guests = invitation.guests.filter((guest) => guest.id !== guestId);
  });
}
