import { NextResponse } from 'next/server';
import { canManage } from '@/lib/access';
import { currentUser } from '@/lib/auth';
import { REMINDER_AUDIENCES } from '@/lib/reminder-audience';
import { makeReminder, runDueReminders } from '@/lib/reminders';
import { getInvitation, mutateInvitation } from '@/lib/store';
import type { ReminderAudience } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function managed(id: string) {
  const user = await currentUser();
  const invitation = await getInvitation(id);
  if (!invitation || !canManage(invitation, user)) return null;
  return invitation;
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const invitation = await managed(id);
  if (!invitation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as
    | {
        sendAt?: string;
        audience?: string;
        channel?: string;
        sendNow?: boolean;
      }
    | null;

  const audience = REMINDER_AUDIENCES.includes(body?.audience as ReminderAudience)
    ? (body?.audience as ReminderAudience)
    : 'pending';
  const channel = body?.channel === 'text' ? 'text' : 'email';
  const sendNow = Boolean(body?.sendNow);

  const when = new Date(body?.sendAt ?? '');
  if (!sendNow && Number.isNaN(when.getTime())) {
    return NextResponse.json({ error: 'Pick a date and time for the reminder.' }, { status: 400 });
  }
  const sendAt = sendNow ? new Date().toISOString() : when.toISOString();

  const reminder = makeReminder({ sendAt, audience, channel });
  await mutateInvitation(id, (current) => {
    current.reminders = [...(current.reminders ?? []), reminder].slice(-25);
  });

  if (sendNow) {
    const origin = request.headers.get('origin') ?? new URL(request.url).origin;
    const fresh = await getInvitation(id);
    if (fresh) await runDueReminders(fresh, origin);
  }

  const latest = await getInvitation(id);
  return NextResponse.json({
    reminders: latest?.reminders ?? [],
    remindersSent: sendNow,
  });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const invitation = await managed(id);
  if (!invitation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const reminderId = new URL(request.url).searchParams.get('reminderId');
  if (!reminderId) return NextResponse.json({ error: 'Missing reminder' }, { status: 400 });

  const updated = await mutateInvitation(id, (current) => {
    current.reminders = (current.reminders ?? []).filter(
      (reminder) => reminder.id !== reminderId || reminder.status !== 'scheduled',
    );
  });

  return NextResponse.json({ reminders: updated?.reminders ?? [] });
}
