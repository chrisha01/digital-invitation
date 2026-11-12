import { NextResponse } from 'next/server';
import {
  issueSession,
  resetPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
  validatePassword,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { token?: string; password?: string }
    | null;

  const token = (body?.token ?? '').trim();
  const password = body?.password ?? '';
  if (!token) return NextResponse.json({ error: 'That reset link is incomplete.' }, { status: 400 });

  const problem = validatePassword(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const user = await resetPassword(token, password);
  if (!user) {
    return NextResponse.json(
      { error: 'That reset link has expired or already been used. Request a new one.' },
      { status: 400 },
    );
  }

  // A successful reset signs them straight in, with older sessions retired.
  const response = NextResponse.json({ user });
  response.cookies.set(
    SESSION_COOKIE,
    await issueSession(user.id, user.sessionVersion),
    sessionCookieOptions(),
  );
  return response;
}
