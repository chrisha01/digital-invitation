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

/**
 * Best-effort caller identity. Behind a proxy the first X-Forwarded-For entry is
 * the original client; everything else falls back to a shared bucket.
 */
export function callerKey(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const address =
    forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'local';
  return `${scope}:${address}`;
}

/** The 429 every limited route returns, with a Retry-After the browser honours. */
export function tooManyRequests(retryAfterSeconds: number) {
  return {
    error: 'Too many attempts. Please wait a moment and try again.',
    retryAfterSeconds,
  };
}
