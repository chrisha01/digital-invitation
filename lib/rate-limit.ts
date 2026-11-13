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

/** The browser id cookie, also stamped onto the request by `middleware.ts`. */
export const CLIENT_COOKIE = 'gatherly_client';
/** Request header the middleware sets; it overwrites anything the client sent. */
export const CLIENT_HEADER = 'x-gatherly-client';

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Off unless the app really sits behind a proxy that appends the caller address.
 * Without a proxy, `X-Forwarded-For` is written by the client and cannot be
 * trusted for anything.
 */
function trustsProxy(): boolean {
  const value = (process.env.TRUST_PROXY ?? '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

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

/**
 * Behind a trusted proxy the rightmost `X-Forwarded-For` entry is the address
 * our proxy appended (earlier entries are client-supplied and spoofable).
 * Everywhere else the key is the per-browser id the middleware stamps onto the
 * request, or a shared bucket when the browser sent no cookie yet.
 */
export function callerKey(request: Request, scope: string): string {
  if (trustsProxy()) {
    const forwarded = request.headers.get('x-forwarded-for');
    const hops = (forwarded ?? '')
      .split(',')
      .map((hop) => hop.trim())
      .filter(Boolean);
    const address = hops.at(-1) ?? request.headers.get('x-real-ip')?.trim() ?? '';
    if (address) return `${scope}:ip:${address}`;
  }

  const client = request.headers.get(CLIENT_HEADER)?.trim();
  return `${scope}:client:${client || 'anonymous'}`;
}

/** The 429 every limited route returns, with a Retry-After the browser honours. */
export function tooManyRequests(retryAfterSeconds: number) {
  return {
    error: 'Too many attempts. Please wait a moment and try again.',
    retryAfterSeconds,
  };
}
