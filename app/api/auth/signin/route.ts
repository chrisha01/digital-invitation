import { NextResponse } from 'next/server';
import { issueSession, SESSION_COOKIE, sessionCookieOptions, verifyUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;

  const email = (body?.email ?? '').trim();
  const password = body?.password ?? '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });
  }

  const user = await verifyUser(email, password);
  if (!user) {
    return NextResponse.json({ error: 'Email or password is not right.' }, { status: 401 });
  }

  const response = NextResponse.json({ user });
  response.cookies.set(
    SESSION_COOKIE,
    await issueSession(user.id, user.sessionVersion),
    sessionCookieOptions(),
  );
  return response;
}
