import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { buildInvitation } from '@/lib/defaults';
import { listInvitations, putInvitation } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  return NextResponse.json({ invitations: await listInvitations(user.id) });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { design?: string } | null;
  const invitation = buildInvitation(body?.design);
  invitation.ownerId = user.id;
  await putInvitation(invitation);
  return NextResponse.json({ invitation }, { status: 201 });
}
