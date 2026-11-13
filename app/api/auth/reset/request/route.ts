import { NextResponse } from 'next/server';
import { createResetToken } from '@/lib/auth';
import { emailSetup, sendEmail } from '@/lib/email';
import { callerKey, rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * The one-time link goes out by email when a provider is connected. Without one
 * it is only handed back in development: returning it in production would let
 * anyone who knows an address take over that account. The answer never says
 * whether the address has an account.
 */
export async function POST(request: Request) {
  const limit = rateLimit(callerKey(request, 'reset'), 5, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(tooManyRequests(limit.retryAfterSeconds), {
      status: 429,
      headers: { 'retry-after': String(limit.retryAfterSeconds) },
    });
  }

  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = (body?.email ?? '').trim();

  if (!email) return NextResponse.json({ error: 'Enter your email.' }, { status: 400 });

  const token = await createResetToken(email);
  if (!token) return NextResponse.json({ ok: true });

  const setup = emailSetup();
  if (setup.provider) {
    const origin = request.headers.get('origin') ?? new URL(request.url).origin;
    const link = `${origin}/reset?token=${encodeURIComponent(token)}`;
    try {
      await sendEmail(setup, {
        to: email.toLowerCase(),
        subject: 'Reset your Gatherly password',
        text: [
          'Someone asked to reset the password for this address on Gatherly.',
          '',
          'Set a new password — the link works once and expires in 30 minutes:',
          link,
          '',
          'If this was not you, ignore this message; your password has not changed.',
        ].join('\n'),
      });
    } catch {
      // Delivery trouble must not tell the caller whether the account exists.
    }
    return NextResponse.json({ ok: true });
  }

  // Local development has no inbox to check, so the link is handed back here.
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json({
      ok: true,
      url: `/reset?token=${encodeURIComponent(token)}`,
    });
  }

  return NextResponse.json({ ok: true });
}
