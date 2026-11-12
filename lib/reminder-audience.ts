import type { Guest, ReminderAudience } from './types';

export const REMINDER_AUDIENCES: ReminderAudience[] = ['pending', 'maybe', 'all'];

/** Nudge the people who still owe a reply; never the ones who already declined. */
export function reminderRecipients(
  guests: Guest[],
  audience: ReminderAudience,
  channel: 'email' | 'text',
): Guest[] {
  return guests.filter((guest) => {
    if (guest.companionOf) return false;
    if (guest.status === 'no') return false;
    if (audience === 'pending' && guest.status !== 'invited') return false;
    if (audience === 'maybe' && guest.status !== 'maybe') return false;
    return channel === 'email'
      ? Boolean(guest.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(guest.email.trim()))
      : Boolean(guest.phone && guest.smsConsent);
  });
}
