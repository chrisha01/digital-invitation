import { NextResponse } from 'next/server';
import { canManage } from '@/lib/access';
import { currentUser } from '@/lib/auth';
import { mergeGuests } from '@/lib/guest-merge';
import { handOverSeat } from '@/lib/seating';
import { getInvitation, mutateInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * A duplicate row is the same guest entered twice, so merging keeps one row and
 * carries the other's reply, notes and check-in onto it. Only a host may do it:
 * a guest link can move its own reply, never another guest's row.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await currentUser();
  const invitation = await getInvitation(id);
  if (!invitation || !canManage(invitation, user)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | { fromId?: string; intoId?: string }
    | null;
  const fromId = (body?.fromId ?? '').trim();
  const intoId = (body?.intoId ?? '').trim();
  if (!fromId || !intoId || fromId === intoId) {
    return NextResponse.json({ error: 'Choose two different guests to merge.' }, { status: 400 });
  }

  let merged = false;
  const updated = await mutateInvitation(id, (current) => {
    const guests = mergeGuests(current.guests, fromId, intoId);
    if (!guests) return;
    current.guests = guests;
    if (current.seating) current.seating = handOverSeat(current.seating, fromId, intoId);
    merged = true;
  });

  if (!updated || !merged) {
    return NextResponse.json({ error: 'Those guests are no longer on the list.' }, { status: 404 });
  }
  return NextResponse.json({ guests: updated.guests });
}
