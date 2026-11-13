import { NextResponse } from 'next/server';
import { issueSession, SESSION_COOKIE, sessionCookieOptions, verifyUser } from '@/lib/auth';
import { rateGate, rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Ten wrong guesses at one address, or twenty from one caller, per window. */
const WINDOW_MS = 10 * 60 * 1000;
const PER_ADDRESS = 10;
const PER_CALLER = 20;

export async function POST(request: Request) {
  const gate = await rateGate(request, 'signin', PER_CALLER, WINDOW_MS);
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;

  const email = (body?.email ?? '').trim();
  const password = body?.password ?? '';
  if (!email || !password) {
    return gate.applyCookie(
      NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 }),
    );
  }

  const address = rateLimit(`signin:address:${email.toLowerCase()}`, PER_ADDRESS, WINDOW_MS);
  if (!address.ok) {
    return gate.applyCookie(
      NextResponse.json(tooManyRequests(address.retryAfterSeconds), {
        status: 429,
        headers: { 'retry-after': String(address.retryAfterSeconds) },
      }),
    );
  }

  const user = await verifyUser(email, password);
  if (!user) {
    return gate.applyCookie(
      NextResponse.json({ error: 'Email or password is not right.' }, { status: 401 }),
    );
  }

  const response = NextResponse.json({ user });
  response.cookies.set(
    SESSION_COOKIE,
    await issueSession(user.id, user.sessionVersion),
    sessionCookieOptions(),
  );
  return gate.applyCookie(response);
}
