import { NextResponse } from 'next/server';
import { canManage } from '@/lib/access';
import { currentUser } from '@/lib/auth';
import { newId } from '@/lib/defaults';
import { emailRecipients, emailSetup, sendEmail } from '@/lib/email';
import { getInvitation, mutateInvitation } from '@/lib/store';
import type { EmailBlast, TextAudience } from '@/lib/types';

export const dynamic = 'force-dynamic';

const AUDIENCES: TextAudience[] = ['attending', 'pending', 'all'];

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const payload = (await request.json().catch(() => null)) as
    | { subject?: string; body?: string; audience?: string; includeLink?: boolean }
    | null;

  const subject = (payload?.subject ?? '').trim().slice(0, 140);
  const body = (payload?.body ?? '').trim().slice(0, 4000);
  const audience = AUDIENCES.includes(payload?.audience as TextAudience)
    ? (payload?.audience as TextAudience)
    : 'attending';
  const includeLink = payload?.includeLink !== false;

  if (!subject) return NextResponse.json({ error: 'Give the email a subject.' }, { status: 400 });
  if (!body) return NextResponse.json({ error: 'Write the message first.' }, { status: 400 });

  const user = await currentUser();
  const invitation = await getInvitation(id);
  if (!invitation || !canManage(invitation, user)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const recipients = emailRecipients(invitation.guests, audience);
  if (!recipients.length) {
    return NextResponse.json(
      { error: 'Nobody in that group has an email address.' },
      { status: 400 },
    );
  }

  // The Origin header is ours on a same-origin fetch; the request URL covers
  // everything else, so links in the email always point back at this host.
  const origin = request.headers.get('origin') ?? new URL(request.url).origin;

  const setup = emailSetup();
  const record = (blast: EmailBlast) =>
    mutateInvitation(id, (current) => {
      current.emails = [...(current.emails ?? []), blast].slice(-30);
    });

  if (!setup.provider) {
    // Nothing leaves the app until a provider is connected; the attempt is logged.
    const blast: EmailBlast = {
      id: newId('email'),
      subject,
      body,
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
        error: 'Sending is off until an email provider is connected.',
        missing: setup.missing,
        recipients: recipients.length,
        emails: updated?.emails ?? [blast],
      },
      { status: 501 },
    );
  }

  let delivered = 0;
  const failures: { guest: string; reason: string }[] = [];
  for (const guest of recipients) {
    const text = includeLink
      ? `${body}\n\nYour invitation: ${origin}/i/${id}?g=${guest.id}`
      : body;
    try {
      await sendEmail(setup, { to: guest.email.trim(), subject, text });
      delivered += 1;
    } catch (error) {
      failures.push({
        guest: guest.name,
        reason: error instanceof Error ? error.message.slice(0, 200) : 'Unknown error',
      });
    }
  }

  const blast: EmailBlast = {
    id: newId('email'),
    subject,
    body,
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
    emails: updated?.emails ?? [blast],
  });
}
