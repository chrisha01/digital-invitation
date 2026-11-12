import { NextResponse } from 'next/server';
import { canManage } from '@/lib/access';
import { currentUser } from '@/lib/auth';
import { checkInCounts, readCheckInCode } from '@/lib/checkin';
import { getInvitation, mutateInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await currentUser();
  const body = (await request.json().catch(() => null)) as
    | { code?: string; guestId?: string; undo?: boolean }
    | null;

  const invitation = await getInvitation(id);
  if (!invitation || !canManage(invitation, user)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const guestId = body?.guestId?.trim() || readCheckInCode(body?.code ?? '', id);
  if (!guestId) return NextResponse.json({ error: 'Scan a pass or type a name.' }, { status: 400 });
  if (!invitation.guests.some((guest) => guest.id === guestId)) {
    return NextResponse.json({ error: 'That pass is not on this guest list.' }, { status: 404 });
  }

  const updated = await mutateInvitation(id, (current) => {
    const guest = current.guests.find((candidate) => candidate.id === guestId);
    if (!guest) return;
    if (body?.undo) {
      guest.checkedInAt = null;
      guest.checkedInBy = undefined;
    } else {
      guest.checkedInAt = new Date().toISOString();
      guest.checkedInBy = user?.name || user?.email || 'Door team';
    }
  });

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    guests: updated.guests,
    counts: checkInCounts(updated),
    guest: updated.guests.find((guest) => guest.id === guestId) ?? null,
  });
}
