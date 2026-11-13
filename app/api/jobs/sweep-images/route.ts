import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runSweepJob, sweepConfigured } from '@/lib/sweep-images';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Shared secret for cron and the local CLI; never the user's session cookie. */
function authorised(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;

  const header = request.headers.get('authorization') ?? '';
  const provided = header.replace(/^Bearer\s+/i, '') || (request.headers.get('x-cron-secret') ?? '');
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ error: 'CRON_SECRET is not set on this server.' }, { status: 503 });
  }
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!sweepConfigured()) {
    return NextResponse.json({ error: 'Object storage is not configured.' }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    delete?: boolean;
    graceHours?: number;
  } | null;

  try {
    const job = await runSweepJob({
      remove: body?.delete === true,
      graceHours: typeof body?.graceHours === 'number' ? body.graceHours : undefined,
    });
    // Another run holds the lock; the caller can simply try again later.
    if (!job.ran) {
      return NextResponse.json({ error: 'A sweep is already running.' }, { status: 409 });
    }
    return NextResponse.json(job.result);
  } catch (error) {
    console.error('[sweep] endpoint failed', error);
    return NextResponse.json({ error: 'The sweep failed.' }, { status: 500 });
  }
}
