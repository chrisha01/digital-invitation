import { NextResponse } from 'next/server';
import { canManage } from '@/lib/access';
import { currentUser } from '@/lib/auth';
import { guestFromCopy } from '@/lib/guest-restore';
import { mergeGuests } from '@/lib/guest-merge';
import { handOverSeat, resolveSeating } from '@/lib/seating';
import { getInvitation, mutateInvitation } from '@/lib/store';
import type { Guest, SeatingPlan } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** What the dashboard needs to put both rows back exactly as they were. */
type MergeUndo = {
  from: Guest;
  into: Guest;
  index: number;
  seating: SeatingPlan | null;
};

/** A seat plan the dashboard kept, normalised so nothing odd lands in the document. */
function planFromCopy(input: unknown): SeatingPlan | null {
  if (!input || typeof input !== 'object') return null;
  const plan = input as SeatingPlan;
  if (!Array.isArray(plan.tables)) return null;
  return resolveSeating({
    ...plan,
    tables: plan.tables.filter((table) => table && typeof table === 'object'),
    items: (Array.isArray(plan.items) ? plan.items : []).filter(
      (item) => item && typeof item === 'object',
    ),
  });
}

/**
 * A duplicate row is the same guest entered twice, so merging keeps one row and
 * carries the other's reply, notes and check-in onto it. Only a host may do it:
 * a guest link can move its own reply, never another guest's row.
 *
 * The same endpoint takes a merge back: the dashboard holds the two rows and the
 * seat plan as they were, and posts them here when the undo is pressed.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await currentUser();
  const invitation = await getInvitation(id);
  if (!invitation || !canManage(invitation, user)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        fromId?: string;
        intoId?: string;
        undo?: { from?: Partial<Guest>; into?: Partial<Guest>; index?: number; seating?: unknown };
      }
    | null;

  if (body?.undo) {
    const from = guestFromCopy(body.undo.from);
    const into = guestFromCopy(body.undo.into);
    if (!from || !into) return NextResponse.json({ error: 'Nothing to undo.' }, { status: 400 });
    const index = Math.max(0, Math.floor(Number(body.undo.index) || 0));
    const plan = planFromCopy(body.undo.seating);

    let restored = false;
    const updated = await mutateInvitation(id, (current) => {
      const at = current.guests.findIndex((guest) => guest.id === into.id);
      // The kept row is gone, or something already put the other row back:
      // restoring now would add a row this undo never took away.
      if (at < 0 || current.guests.some((guest) => guest.id === from.id)) return;
      current.guests[at] = into;
      current.guests.splice(Math.min(index, current.guests.length), 0, from);
      if (plan) current.seating = plan;
      restored = true;
    });

    if (!updated || !restored) {
      return NextResponse.json({ error: 'That merge can no longer be undone.' }, { status: 409 });
    }
    return NextResponse.json({ guests: updated.guests });
  }

  const fromId = (body?.fromId ?? '').trim();
  const intoId = (body?.intoId ?? '').trim();
  if (!fromId || !intoId || fromId === intoId) {
    return NextResponse.json({ error: 'Choose two different guests to merge.' }, { status: 400 });
  }

  let merged = false;
  let undo: MergeUndo | null = null;
  const updated = await mutateInvitation(id, (current) => {
    const from = current.guests.find((guest) => guest.id === fromId);
    const into = current.guests.find((guest) => guest.id === intoId);
    const guests = from && into ? mergeGuests(current.guests, fromId, intoId) : null;
    if (!from || !into || !guests) return;

    // Capture both rows as they are now: merging replaces one and drops the
    // other, so this is the only copy that can put them back.
    undo = {
      from,
      into,
      index: current.guests.findIndex((guest) => guest.id === fromId),
      seating: current.seating ?? null,
    };
    current.guests = guests;
    if (current.seating) current.seating = handOverSeat(current.seating, fromId, intoId);
    merged = true;
  });

  if (!updated || !merged) {
    return NextResponse.json({ error: 'Those guests are no longer on the list.' }, { status: 404 });
  }
  return NextResponse.json({ guests: updated.guests, undo });
}
