import { NextResponse } from 'next/server';
import { canManage } from '@/lib/access';
import { currentUser } from '@/lib/auth';
import { cleanSeating, dropUnknownChairs } from '@/lib/seating';
import { getInvitation, mutateInvitation } from '@/lib/store';

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await ctx.params;
  const owned = user ? await getInvitation(id) : null;
  if (!owned || !canManage(owned, user)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const body: unknown = await request.json().catch(() => null);
  const seating = cleanSeating(body);
  if (!seating) return NextResponse.json({ error: 'Invalid seating plan' }, { status: 400 });

  const updated = await mutateInvitation(id, (invitation) => {
    // A chair only holds someone still on the list, as it is now rather than
    // as the browser saw it.
    invitation.seating = {
      ...dropUnknownChairs(seating, invitation.guests),
      updatedAt: new Date().toISOString(),
    };
  });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ seating: updated.seating });
}
