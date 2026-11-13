import { NextResponse, type NextRequest } from 'next/server';
import { CLIENT_COOKIE, CLIENT_HEADER } from './lib/rate-limit';

/**
 * Gives every browser a stable, opaque id so rate limits can tell callers apart
 * without trusting a client-supplied header. Any `x-gatherly-client` the client
 * sends is discarded and replaced with the value from the signed-in cookie; a
 * browser with no cookie yet is limited in a shared bucket until it has one, so
 * dropping cookies cannot buy a fresh allowance on every request.
 */
export function middleware(request: NextRequest) {
  const stored = request.cookies.get(CLIENT_COOKIE)?.value;
  const known = stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stored)
    ? stored
    : null;
  const id = known ?? crypto.randomUUID();

  const headers = new Headers(request.headers);
  headers.delete(CLIENT_HEADER);
  if (known) headers.set(CLIENT_HEADER, id);

  const response = NextResponse.next({ request: { headers } });

  if (!known) {
    response.cookies.set(CLIENT_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
