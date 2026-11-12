import { newId } from './defaults';
import { emailSetup, sendEmail } from './email';
import { reminderRecipients } from './reminder-audience';
import { smsSetup, sendText } from './sms';
import { getInvitation, mutateInvitation } from './store';
import type { Guest, Invitation, Reminder, ReminderAudience } from './types';

function when(inv: Invitation): string {
  const start = inv.event.startsAt ? new Date(inv.event.startsAt) : null;
  if (!start || Number.isNaN(start.getTime())) return 'the day';
  return start.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function reminderSubject(inv: Invitation): string {
  return `A quick RSVP nudge — ${inv.title}`;
}

export function reminderBody(inv: Invitation, guest: Guest, link: string): string {
  const firstName = guest.name.split(' ')[0] || 'there';
  return [
    `Hello ${firstName},`,
    '',
    `We are still collecting replies for ${inv.event.title || inv.title} on ${when(inv)}.`,
    `Could you let us know whether you can make it? It only takes a moment:`,
    link,
    '',
    `Thank you — ${inv.event.host}`,
  ].join('\n');
}

/** A text needs to fit in as few segments as possible. */
export function reminderText(inv: Invitation, guest: Guest, link: string): string {
  const firstName = guest.name.split(' ')[0] || 'there';
  return `Hi ${firstName}, still collecting replies for ${inv.title} on ${when(inv)}. Can you make it? ${link}`;
}

export function makeReminder(input: {
  sendAt: string;
  audience: ReminderAudience;
  channel: 'email' | 'text';
}): Reminder {
  return {
    id: newId('reminder'),
    sendAt: input.sendAt,
    audience: input.audience,
    channel: input.channel,
    createdAt: new Date().toISOString(),
    status: 'scheduled',
  };
}

type Outcome = Pick<Reminder, 'id' | 'status' | 'recipients' | 'delivered' | 'failed' | 'detail'>;

/** A send that crashed leaves its claim behind; after this long another run may take it. */
const CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Sends every scheduled reminder whose time has passed. There is no cron in this
 * app, so the host dashboard calls this when it loads.
 *
 * Opening the dashboard in two tabs must not text everyone twice, so a reminder
 * is first claimed inside the store's queued write. Exactly one request wins the
 * claim and owns the send; any request that loses the race sees the claim and
 * returns without sending. A claim left behind by a crashed send may be retried
 * after fifteen minutes.
 */
export async function runDueReminders(invitation: Invitation, origin = ''): Promise<Invitation> {
  const now = Date.now();
  const claimToken = newId('claim');
  const claimedAt = new Date(now).toISOString();
  const staleBefore = new Date(now - CLAIM_TIMEOUT_MS).toISOString();

  const claimed = await mutateInvitation(invitation.id, (current) => {
    const due = (current.reminders ?? [])
      .filter((reminder) => {
        if (reminder.status !== 'scheduled') return false;
        if (new Date(reminder.sendAt).getTime() > now) return false;
        return !reminder.sendingId || (reminder.claimedAt ?? '') < staleBefore;
      })
      .slice(0, 5)
      .map((reminder) => reminder.id);

    current.reminders = (current.reminders ?? []).map((reminder) =>
      due.includes(reminder.id) ? { ...reminder, sendingId: claimToken, claimedAt } : reminder,
    );
  });

  const mine = (claimed?.reminders ?? []).filter((reminder) => reminder.sendingId === claimToken);
  if (!claimed || !mine.length) {
    // Lost the claim to another request: read the state that request left behind.
    return (await getInvitation(invitation.id)) ?? claimed ?? invitation;
  }

  const mail = emailSetup();
  const sms = smsSetup();
  const outcomes: Outcome[] = [];

  for (const reminder of mine) {
    const channel = reminder.channel === 'text' ? 'text' : 'email';
    const recipients = reminderRecipients(claimed.guests, reminder.audience, channel);

    if (!recipients.length) {
      outcomes.push({
        id: reminder.id,
        status: 'failed',
        recipients: 0,
        delivered: 0,
        failed: 0,
        detail: 'Nobody in that group can be reached on this channel.',
      });
      continue;
    }

    const provider = channel === 'email' ? mail.provider : sms.provider;
    if (!provider) {
      const missing = channel === 'email' ? mail.missing : sms.missing;
      outcomes.push({
        id: reminder.id,
        status: 'not-configured',
        recipients: recipients.length,
        delivered: 0,
        failed: 0,
        detail: `Add ${missing.join(', ')} to .env and restart to send.`,
      });
      continue;
    }

    let delivered = 0;
    const failures: string[] = [];
    for (const guest of recipients) {
      const link = origin ? `${origin}/i/${invitation.id}?g=${guest.id}` : `/i/${invitation.id}?g=${guest.id}`;
      try {
        if (channel === 'email') {
          await sendEmail(mail, {
            to: (guest.email ?? '').trim(),
            subject: reminderSubject(invitation),
            text: reminderBody(invitation, guest, link),
          });
        } else {
          await sendText(sms, (guest.phone ?? '').trim(), reminderText(invitation, guest, link));
        }
        delivered += 1;
      } catch (error) {
        failures.push(
          `${guest.name}: ${error instanceof Error ? error.message.slice(0, 120) : 'failed'}`,
        );
      }
    }

    outcomes.push({
      id: reminder.id,
      status: delivered === recipients.length ? 'sent' : delivered ? 'partial' : 'failed',
      recipients: recipients.length,
      delivered,
      failed: failures.length,
      ...(failures.length ? { detail: failures.slice(0, 3).join(' · ') } : {}),
    });
  }

  const updated = await mutateInvitation(invitation.id, (current) => {
    const stamp = new Date().toISOString();
    current.reminders = (current.reminders ?? []).map((reminder) => {
      if (reminder.sendingId !== claimToken) return reminder;
      const outcome = outcomes.find((entry) => entry.id === reminder.id);
      const rest = { ...reminder };
      delete rest.sendingId;
      delete rest.claimedAt;
      return outcome ? { ...rest, ...outcome, sentAt: stamp } : rest;
    });
  });

  return updated ?? claimed;
}
