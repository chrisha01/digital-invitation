import type { Guest, TextAudience } from './types';

export type EmailProvider = 'resend' | 'webhook' | null;

export type EmailSetup = {
  provider: EmailProvider;
  from: string;
  /** env vars still needed when no provider is ready */
  missing: string[];
};

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
};

const RESEND_KEYS = ['RESEND_API_KEY', 'EMAIL_FROM'];
const WEBHOOK_KEYS = ['EMAIL_API_URL', 'EMAIL_API_KEY', 'EMAIL_FROM'];

/**
 * Resend when its two variables are set, otherwise a generic JSON gateway
 * (Postmark, Mailgun, Plunk, an internal service) behind EMAIL_API_URL.
 *
 * Neither option is a mail server we run: the provider does the delivering and
 * a verified sender address does the authenticating, so nothing here touches
 * SPF, DKIM or port 25.
 */
export function emailSetup(): EmailSetup {
  const resendMissing = RESEND_KEYS.filter((key) => !process.env[key]);
  if (!resendMissing.length) {
    return { provider: 'resend', from: process.env.EMAIL_FROM as string, missing: [] };
  }

  const webhookMissing = WEBHOOK_KEYS.filter((key) => !process.env[key]);
  if (!webhookMissing.length) {
    return { provider: 'webhook', from: process.env.EMAIL_FROM as string, missing: [] };
  }

  return {
    provider: null,
    from: '',
    missing: resendMissing.length <= webhookMissing.length ? resendMissing : webhookMissing,
  };
}

/** Cheap shape check; a bounce is the provider's job to report. */
export function looksLikeEmail(value: string | undefined): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()));
}

/** Everyone with an address, narrowed by the audience the host picked. */
export function emailRecipients(guests: Guest[], audience: TextAudience): Guest[] {
  return guests.filter((guest) => {
    if (!looksLikeEmail(guest.email)) return false;
    if (audience === 'attending') return guest.status === 'yes';
    if (audience === 'pending') return guest.status === 'invited';
    return true;
  });
}

export async function sendEmail(setup: EmailSetup, email: OutgoingEmail): Promise<void> {
  if (!setup.provider) throw new Error('No email provider configured.');

  if (setup.provider === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: setup.from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend replied ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return;
  }

  const res = await fetch(process.env.EMAIL_API_URL as string, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ to: email.to, from: setup.from, subject: email.subject, text: email.text }),
  });
  if (!res.ok) {
    throw new Error(`Email gateway replied ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}
