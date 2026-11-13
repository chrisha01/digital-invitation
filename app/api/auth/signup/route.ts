import { NextResponse } from 'next/server';
import {
  createUser,
  isOnlyUser,
  issueSession,
  SESSION_COOKIE,
  sessionCookieOptions,
  validateSignup,
} from '@/lib/auth';
import { rateGate } from '@/lib/rate-limit';
import { claimOrphanInvitations } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Making accounts is cheap to script and costly to clear up. */
const SIGNUPS_PER_HOUR = 10;

export async function POST(request: Request) {
  const gate = await rateGate(request, 'signup', SIGNUPS_PER_HOUR, 60 * 60 * 1000);
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as
    | { name?: string; email?: string; password?: string }
    | null;

  const checked = validateSignup(body ?? {});
  if ('error' in checked) {
    return gate.applyCookie(NextResponse.json({ error: checked.error }, { status: 400 }));
  }

  const user = await createUser(checked.name, checked.email, checked.password);
  if (!user) {
    return gate.applyCookie(
      NextResponse.json(
        { error: 'That email already has an account. Sign in instead.' },
        { status: 409 },
      ),
    );
  }

  // Invitations made before accounts existed belong to the person who sets up
  // the first account on this machine.
  if (await isOnlyUser(user.id)) await claimOrphanInvitations(user.id);

  const response = NextResponse.json({ user }, { status: 201 });
  response.cookies.set(
    SESSION_COOKIE,
    await issueSession(user.id, user.sessionVersion),
    sessionCookieOptions(),
  );
  return gate.applyCookie(response);
}
