import { NextResponse } from 'next/server';
import { createResetToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * No email provider is connected, so the one-time link is handed back to the
 * page that asked for it. The response is the same whether or not the account
 * exists, apart from the link itself.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = (body?.email ?? '').trim();

  if (!email) return NextResponse.json({ error: 'Enter your email.' }, { status: 400 });

  const token = await createResetToken(email);
  return NextResponse.json({
    ok: true,
    ...(token ? { url: `/reset?token=${encodeURIComponent(token)}` } : {}),
  });
}
