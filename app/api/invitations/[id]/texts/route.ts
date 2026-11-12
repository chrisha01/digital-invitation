import { NextResponse } from 'next/server';
import { canManage } from '@/lib/access';
import { currentUser } from '@/lib/auth';
import { newId } from '@/lib/defaults';
import { getInvitation, mutateInvitation } from '@/lib/store';
import { sendText, smsSetup, textRecipients } from '@/lib/sms';
import type { TextAudience, TextBlast } from '@/lib/types';

export const dynamic = 'force-dynamic';

const AUDIENCES: TextAudience[] = ['attending', 'pending', 'all'];

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as
    | { body?: string; audience?: string }
    | null;

  const text = (body?.body ?? '').trim().slice(0, 480);
  const audience = AUDIENCES.includes(body?.audience as TextAudience)
    ? (body?.audience as TextAudience)
    : 'attending';

  if (!text) return NextResponse.json({ error: 'Write the message first.' }, { status: 400 });

  const user = await currentUser();
  const invitation = await getInvitation(id);
  if (!invitation || !canManage(invitation, user)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const recipients = textRecipients(invitation.guests, audience);
  if (!recipients.length) {
    return NextResponse.json(
      { error: 'Nobody in that group has a number and consent to be texted.' },
      { status: 400 },
    );
  }

  const setup = smsSetup();
  const record = (blast: TextBlast) =>
    mutateInvitation(id, (current) => {
      current.texts = [...(current.texts ?? []), blast].slice(-30);
    });

  if (!setup.provider) {
    // Nothing leaves the app until a provider is connected; the attempt is logged.
    const blast: TextBlast = {
      id: newId('text'),
      body: text,
      audience,
      sentAt: new Date().toISOString(),
      recipients: recipients.length,
      delivered: 0,
      failed: 0,
      status: 'not-configured',
      detail: `Add ${setup.missing.join(', ')} to .env and restart to send.`,
    };
    const updated = await record(blast);
    return NextResponse.json(
      {
        error: 'Sending is off until an SMS provider is connected.',
        missing: setup.missing,
        recipients: recipients.length,
        texts: updated?.texts ?? [blast],
      },
      { status: 501 },
    );
  }

  let delivered = 0;
  const failures: { guest: string; reason: string }[] = [];
  for (const guest of recipients) {
    try {
      await sendText(setup, guest.phone as string, text);
      delivered += 1;
    } catch (error) {
      failures.push({
        guest: guest.name,
        reason: error instanceof Error ? error.message.slice(0, 200) : 'Unknown error',
      });
    }
  }

  const blast: TextBlast = {
    id: newId('text'),
    body: text,
    audience,
    sentAt: new Date().toISOString(),
    recipients: recipients.length,
    delivered,
    failed: failures.length,
    status: delivered === recipients.length ? 'sent' : delivered ? 'partial' : 'failed',
    ...(failures.length ? { detail: failures.slice(0, 3).map((f) => `${f.guest}: ${f.reason}`).join(' · ') } : {}),
  };

  const updated = await record(blast);

  return NextResponse.json({
    blast,
    sent: delivered,
    failed: failures.length,
    recipients: recipients.length,
    failures: failures.slice(0, 5),
    texts: updated?.texts ?? [blast],
  });
}
