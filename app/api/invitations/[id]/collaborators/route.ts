import { NextResponse } from 'next/server';
import { isOwner } from '@/lib/access';
import { currentUser } from '@/lib/auth';
import { getInvitation, mutateInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

const MAX_COLLABORATORS = 10;

async function ownerOnly(id: string) {
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) };
  const invitation = await getInvitation(id);
  if (!invitation) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (!isOwner(invitation, user)) {
    return { error: NextResponse.json({ error: 'Only the owner can do that.' }, { status: 403 }) };
  }
  return { user, invitation };
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const check = await ownerOnly(id);
  if (check.error) return check.error;

  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = (body?.email ?? '').trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'That email does not look right.' }, { status: 400 });
  }
  if (email === check.user.email.toLowerCase()) {
    return NextResponse.json({ error: 'That is your own email.' }, { status: 400 });
  }

  const current = check.invitation.collaborators ?? [];
  if (current.some((entry) => entry.toLowerCase() === email)) {
    return NextResponse.json({ error: 'They already have access.' }, { status: 409 });
  }
  if (current.length >= MAX_COLLABORATORS) {
    return NextResponse.json({ error: 'That is enough co-hosts for one invitation.' }, { status: 400 });
  }

  const updated = await mutateInvitation(id, (invitation) => {
    invitation.collaborators = [...(invitation.collaborators ?? []), email];
  });

  return NextResponse.json({ collaborators: updated?.collaborators ?? [], pending: true });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const check = await ownerOnly(id);
  if (check.error) return check.error;

  const email = (new URL(request.url).searchParams.get('email') ?? '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Missing email.' }, { status: 400 });

  const updated = await mutateInvitation(id, (invitation) => {
    invitation.collaborators = (invitation.collaborators ?? []).filter(
      (entry) => entry.toLowerCase() !== email,
    );
  });

  return NextResponse.json({ collaborators: updated?.collaborators ?? [] });
}
