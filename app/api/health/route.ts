import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A load balancer wants a fast, honest answer. The pool's own connect timeout is
 * ten seconds, which is longer than any probe will wait, so the query is raced
 * against a shorter deadline of our own. Four seconds rather than two because
 * Neon suspends an idle compute: the first probe after a quiet spell genuinely
 * takes around two seconds to wake it and should still report healthy.
 */
const PROBE_TIMEOUT_MS = 4_000;

async function probeDatabase(): Promise<number> {
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('database probe timed out')), PROBE_TIMEOUT_MS);
    timer.unref?.();
  });

  try {
    await Promise.race([getPool().query('select 1'), deadline]);
    return Date.now() - started;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET() {
  const headers = { 'cache-control': 'no-store' };

  try {
    const latencyMs = await probeDatabase();
    return NextResponse.json({ status: 'ok', database: 'up', latencyMs }, { headers });
  } catch (error) {
    // Log the real reason, answer with something that cannot leak the connection
    // string to whoever can reach this route.
    console.error('health: database probe failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ status: 'degraded', database: 'down' }, { status: 503, headers });
  }
}
