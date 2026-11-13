import { NextResponse } from 'next/server';
import { newId } from '@/lib/defaults';
import { callerKey, rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { mutateInvitation } from '@/lib/store';
import type { Guest, RsvpStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** This endpoint is public — guests reply without signing in. */
const RSVPS_PER_WINDOW = 30;
const WINDOW_MS = 10 * 60 * 1000;

class RsvpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Body = {
  name?: string;
  email?: string;
  household?: string;
  dietary?: string;
  accessibility?: string;
  phone?: string;
  smsConsent?: boolean;
  attending?: string;
  plusOnes?: number;
  adults?: number;
  children?: number;
  answers?: Record<string, string>;
  message?: string;
  guestId?: string;
  companions?: string[];
};

const clampCount = (value: unknown, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const partySize = (guest: Guest) =>
  guest.status === 'yes' ? Math.max(1, guest.adults + guest.children, 1 + guest.plusOnes) : 0;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const limit = rateLimit(callerKey(request, `rsvp:${id}`), RSVPS_PER_WINDOW, WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(tooManyRequests(limit.retryAfterSeconds), {
      status: 429,
      headers: { 'retry-after': String(limit.retryAfterSeconds) },
    });
  }

  const body = (await request.json().catch(() => null)) as Body | null;

  const name = (body?.name ?? '').trim().slice(0, 120);
  const email = (body?.email ?? '').trim().slice(0, 200);
  // Keep dialling characters only, so a pasted number stores cleanly.
  const phone = (body?.phone ?? '')
    .replace(/[^\d+()\-\s]/g, '')
    .trim()
    .slice(0, 32);
  const attending = body?.attending;

  if (phone && phone.replace(/\D/g, '').length < 7) {
    return NextResponse.json({ error: 'That mobile number looks incomplete.' }, { status: 400 });
  }

  if (!name) return NextResponse.json({ error: 'Please tell us your name.' }, { status: 400 });
  if (attending !== 'yes' && attending !== 'no' && attending !== 'maybe') {
    return NextResponse.json({ error: 'Please choose a reply.' }, { status: 400 });
  }

  let savedGuestId: string | null = null;

  try {
    const updated = await mutateInvitation(id, (invitation) => {
      if (!invitation.settings.collectRsvp) {
        throw new RsvpError('This invitation is not collecting RSVPs.', 403);
      }
      if (
        invitation.settings.deadline &&
        new Date(invitation.settings.deadline).getTime() < Date.now()
      ) {
        throw new RsvpError('RSVPs for this event have closed.', 403);
      }

      const answers = Object.fromEntries(
        Object.entries(body?.answers ?? {})
          .filter(([key]) => invitation.settings.questions.some((q) => q.id === key))
          .map(([key, value]) => [key, String(value).slice(0, 500)]),
      );

      let guest =
        (body?.guestId ? invitation.guests.find((g) => g.id === body.guestId) : undefined) ??
        (email
          ? invitation.guests.find((g) => g.email && g.email.toLowerCase() === email.toLowerCase())
          : undefined) ??
        invitation.guests.find((g) => g.name.trim().toLowerCase() === name.toLowerCase());

      if (!guest) {
        guest = {
          id: newId('guest'),
          name,
          email,
          tag: '',
          status: 'invited',
          plusOnes: 0,
          adults: 0,
          children: 0,
          answers: {},
          message: '',
          respondedAt: null,
        };
        invitation.guests.push(guest);
      }

      guest.name = name;
      if (email) guest.email = email;
      guest.household = (body?.household ?? '').trim().slice(0, 80) || guest.household || '';
      guest.dietary = (body?.dietary ?? '').trim().slice(0, 300);
      guest.accessibility = (body?.accessibility ?? '').trim().slice(0, 300);
      guest.phone = phone;
      guest.smsConsent = phone ? Boolean(body?.smsConsent) : false;

      const headcount = invitation.settings.headcount;
      const plusOnes = invitation.settings.allowPlusOnes
        ? clampCount(body?.plusOnes, 0, invitation.settings.maxPlusOnes)
        : 0;
      const adults = headcount ? clampCount(body?.adults, 1, 20) : 1;
      const children = headcount ? clampCount(body?.children, 0, 20) : 0;

      const status = attending as RsvpStatus;
      // Each named companion becomes their own guest row, so a plus-one can be
      // renamed and seated in a chair of their own.
      const size = status === 'yes' ? (headcount ? Math.max(1, adults + children) : 1 + plusOnes) : 0;

      if (status === 'yes' && invitation.settings.capacity) {
        const taken = invitation.guests
          .filter((candidate) => candidate.id !== guest!.id && candidate.companionOf !== guest!.id)
          .reduce((sum, candidate) => sum + partySize(candidate), 0);
        if (taken + size > invitation.settings.capacity) {
          throw new RsvpError(
            'Sorry — this event is full. Please reply no or contact the host directly.',
            409,
          );
        }
      }

      guest.status = status;
      guest.plusOnes = 0;
      guest.adults = status === 'yes' ? adults : 0;
      guest.children = status === 'yes' ? children : 0;
      guest.answers = answers;
      guest.message = (body?.message ?? '').slice(0, 2000);
      guest.respondedAt = new Date().toISOString();

      const companions = invitation.guests.filter((row) => row.companionOf === guest!.id);
      if (status === 'yes' && !headcount && invitation.settings.allowPlusOnes) {
        const wanted = plusOnes;
        const names = Array.from({ length: wanted }, (_, index) => {
          const given = String(body?.companions?.[index] ?? '')
            .trim()
            .slice(0, 120);
          return given || `Guest of ${guest!.name}`;
        });

        for (const stale of companions.slice(wanted)) {
          invitation.guests = invitation.guests.filter((row) => row.id !== stale.id);
        }

        companions.slice(0, wanted).forEach((row, index) => {
          row.name = names[index];
          row.status = 'yes';
          row.adults = 1;
          row.children = 0;
          row.plusOnes = 0;
          row.answers = {};
          row.respondedAt = new Date().toISOString();
          row.companionOf = guest!.id;
          if (!row.tag) row.tag = `Plus one of ${guest!.name}`;
        });

        for (let index = companions.length; index < wanted; index += 1) {
          invitation.guests.push({
            id: newId('guest'),
            name: names[index],
            email: '',
            tag: `Plus one of ${guest!.name}`,
            status: 'yes',
            plusOnes: 0,
            adults: 1,
            children: 0,
            answers: {},
            message: '',
            respondedAt: new Date().toISOString(),
            companionOf: guest!.id,
          });
        }
      } else {
        invitation.guests = invitation.guests.filter((row) => row.companionOf !== guest!.id);
      }

      savedGuestId = guest.id;
    });

    if (!updated) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });

    const saved = updated.guests.find((g) => g.id === savedGuestId) ?? null;
    return NextResponse.json({ guest: saved });
  } catch (error) {
    if (error instanceof RsvpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Could not save your reply.' }, { status: 500 });
  }
}
