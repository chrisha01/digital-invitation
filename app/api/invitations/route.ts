import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { buildInvitation } from '@/lib/defaults';
import { PLAN_LABELS, planCap, planKey } from '@/lib/plan-caps';
import { listInvitations, putInvitationWithinCap } from '@/lib/store';

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

  const plan = planKey(user.plan);
  const cap = planCap(plan);
  if (!(await putInvitationWithinCap(invitation, cap))) {
    return NextResponse.json(
      {
        error: `The ${PLAN_LABELS[plan]} plan holds ${cap} ${
          cap === 1 ? 'invitation' : 'invitations'
        }. Delete one to start another, or ask for a larger plan.`,
        plan,
        cap,
      },
      { status: 403 },
    );
  }

  return NextResponse.json({ invitation }, { status: 201 });
}
