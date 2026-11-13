import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sessionSecret } from './auth';

/**
 * A fixed-window limiter kept in process memory. The app already stores its data
 * in one file on one machine, so a single-process limiter fits the same shape:
 * it stops a script hammering sign-in or the public RSVP endpoint, and it resets
 * when the server restarts.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Well above the number of live keys any real traffic creates. */
const MAX_BUCKETS = 5000;

export const CLIENT_COOKIE = 'gatherly_client';
const CLIENT_MAX_AGE = 60 * 60 * 24 * 365;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Callers without a recognised id share this bucket. It is given more headroom
 * than a named caller so a roomful of guests arriving mid-flow still get through,
 * while a script that never keeps a cookie still runs out.
 */
const ANONYMOUS_HEADROOM = 3;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Sweep expired buckets rather than letting the map grow without bound.
  if (buckets.size >= MAX_BUCKETS) {
    for (const [entryKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(entryKey);
    }
    // Still full of live keys: drop the oldest so memory stays bounded.
    if (buckets.size >= MAX_BUCKETS) {
      const oldest = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)[0];
      if (oldest) buckets.delete(oldest[0]);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { ok: true };
}

/** The 429 every limited route returns, with a Retry-After the browser honours. */
export function tooManyRequests(retryAfterSeconds: number) {
  return {
    error: 'Too many attempts. Please wait a moment and try again.',
    retryAfterSeconds,
  };
}

function sign(id: string, secret: string): string {
  return createHmac('sha256', secret).update(id).digest('base64url');
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.split('=');
    if (key.trim() === name) return rest.join('=').trim();
  }
  return null;
}

/** The id this browser was given, and only if the signature proves we issued it. */
async function verifiedClientId(request: Request): Promise<string | null> {
  const raw = cookieValue(request, CLIENT_COOKIE);
  if (!raw) return null;

  const [id, signature] = raw.split('.');
  if (!id || !signature || !UUID.test(id)) return null;

  const expected = Buffer.from(sign(id, await sessionSecret()));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return id;
}

async function newClientCookie(): Promise<string> {
  const id = randomUUID();
  return `${id}.${sign(id, await sessionSecret())}`;
}

/**
 * How many proxies sit in front of the app. Each one appends the address it saw,
 * so the guest is that many entries in from the right: `TRUST_PROXY=1` for nginx,
 * `2` for a CDN edge in front of nginx, and so on. Unset means no proxy is known
 * and `X-Forwarded-For` cannot be trusted at all.
 */
function trustHops(): number {
  const raw = (process.env.TRUST_PROXY ?? '').trim().toLowerCase();
  if (!raw) return 0;
  if (raw === 'true' || raw === 'yes') return 1;
  const hops = Number(raw);
  return Number.isInteger(hops) && hops > 0 ? Math.min(hops, 10) : 0;
}

function isAddress(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-fA-F:.]{3,45}$/.test(value) && /[.:]/.test(value));
}

function addressFromProxy(request: Request, hops: number): string | null {
  const forwarded = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean);

  if (forwarded.length) {
    // Count in from the right. Anything further left was written by the client
    // and is there to be spoofed.
    const address = forwarded[Math.max(0, forwarded.length - hops)] ?? forwarded[0];
    if (isAddress(address)) return address;
  }

  const real = request.headers.get('x-real-ip')?.trim();
  return isAddress(real) ? real : null;
}
export type Gate =
  | { ok: true; applyCookie: (response: NextResponse) => NextResponse }
  | { ok: false; response: NextResponse };

/**
 * Counts this request against its caller's allowance.
 *
 * A caller is named by the address a trusted proxy reports, or failing that by
 * an id this server signed. A forged cookie fails the signature check and is
 * treated as a stranger, so inventing one buys nothing — and a request that is
 * over the limit is never handed a new id, so reloading to mint one does not
 * work either.
 */
export async function rateGate(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
): Promise<Gate> {
  const hops = trustHops();
  const address = hops ? addressFromProxy(request, hops) : null;
  const knownId = address ? null : await verifiedClientId(request);

  const anonymous = !address && !knownId;
  const key = `${scope}:${address ? `ip:${address}` : `client:${knownId ?? 'anonymous'}`}`;
  const result = rateLimit(key, anonymous ? limit * ANONYMOUS_HEADROOM : limit, windowMs);

  if (!result.ok) {
    return {
      ok: false,
      response: NextResponse.json(tooManyRequests(result.retryAfterSeconds), {
        status: 429,
        headers: { 'retry-after': String(result.retryAfterSeconds) },
      }),
    };
  }

  // Only a caller that got through earns an id, so the shared bucket cannot be
  // used as a machine for minting fresh allowances.
  const issued = anonymous ? await newClientCookie() : null;

  return {
    ok: true,
    applyCookie: (response: NextResponse) => {
      if (issued) {
        response.cookies.set(CLIENT_COOKIE, issued, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: CLIENT_MAX_AGE,
          secure: process.env.NODE_ENV === 'production',
        });
      }
      return response;
    },
  };
}
