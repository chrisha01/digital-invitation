import type { Guest, TextAudience } from './types';

export type SmsProvider = 'twilio' | 'webhook' | null;

export type SmsSetup = {
  provider: SmsProvider;
  from: string;
  /** env vars still needed when no provider is ready */
  missing: string[];
};

const TWILIO_KEYS = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'];
const WEBHOOK_KEYS = ['SMS_API_URL', 'SMS_API_KEY', 'SMS_FROM'];

/**
 * Twilio when its three variables are set, otherwise a generic JSON gateway
 * (MessageBird, Plivo, Vonage, an internal service) behind SMS_API_URL.
 */
export function smsSetup(): SmsSetup {
  const twilioMissing = TWILIO_KEYS.filter((key) => !process.env[key]);
  if (!twilioMissing.length) {
    return { provider: 'twilio', from: process.env.TWILIO_FROM_NUMBER as string, missing: [] };
  }

  const webhookMissing = WEBHOOK_KEYS.filter((key) => !process.env[key]);
  if (!webhookMissing.length) {
    return { provider: 'webhook', from: process.env.SMS_FROM as string, missing: [] };
  }

  return {
    provider: null,
    from: '',
    missing: twilioMissing.length <= webhookMissing.length ? twilioMissing : webhookMissing,
  };
}

/** Only guests with a number and explicit consent are ever texted. */
export function textRecipients(guests: Guest[], audience: TextAudience): Guest[] {
  return guests.filter((guest) => {
    if (!guest.phone || !guest.smsConsent) return false;
    if (audience === 'attending') return guest.status === 'yes';
    if (audience === 'pending') return guest.status === 'invited';
    return true;
  });
}

/** 160 characters per segment; good enough for a cost estimate. */
export function smsSegments(body: string): number {
  return Math.max(1, Math.ceil(body.length / 160));
}

export async function sendText(setup: SmsSetup, to: string, body: string): Promise<void> {
  if (!setup.provider) throw new Error('No SMS provider configured.');

  if (setup.provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID as string;
    const token = process.env.TWILIO_AUTH_TOKEN as string;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: setup.from, Body: body }).toString(),
    });
    if (!res.ok) {
      throw new Error(`Twilio replied ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return;
  }

  const res = await fetch(process.env.SMS_API_URL as string, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.SMS_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ to, from: setup.from, body }),
  });
  if (!res.ok) {
    throw new Error(`SMS gateway replied ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}
