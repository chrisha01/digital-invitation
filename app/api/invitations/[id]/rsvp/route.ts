import { NextResponse } from 'next/server';
import { newId } from '@/lib/defaults';
import { guestToken, verifyGuestToken } from '@/lib/guest-token';
import { rateGate } from '@/lib/rate-limit';
import { clampCount, fitsCapacity, guestForReply, rsvpClosedReason } from '@/lib/rsvp-rules';
import { mutateInvitation } from '@/lib/store';
import type { RsvpStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * This endpoint is public — guests reply without signing in — so the cap has to
 * stop a script while still leaving a whole venue's shared wifi comfortable.
 * Browsers are keyed on their own id, so 120 replies per ten minutes is far
 * beyond any single guest and still only a trickle for a script.
 */
const RSVPS_PER_WINDOW = 120;
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
  /** Signature from this guest's personal link; an id without one proves nothing. */
  guestToken?: string;
  companions?: string[];
};

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const gate = await rateGate(request, `rsvp:${id}`, RSVPS_PER_WINDOW, WINDOW_MS);
  if (!gate.ok) return gate.response;

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

  // The guest id is printed on every pass and was in the public page, so on its
  // own it names nobody: only a link this server signed may speak for a row.
  const signedGuestId =
    body?.guestId && (await verifyGuestToken(id, body.guestId, body.guestToken))
      ? body.guestId
      : null;

  let savedGuestId: string | null = null;

  try {
    const updated = await mutateInvitation(id, (invitation) => {
      const closed = rsvpClosedReason(invitation);
      if (closed) {
        throw new RsvpError(
          closed === 'disabled'
            ? 'This invitation is not collecting RSVPs.'
            : 'RSVPs for this event have closed.',
          403,
        );
      }

      const answers = Object.fromEntries(
        Object.entries(body?.answers ?? {})
          .filter(([key]) => invitation.settings.questions.some((q) => q.id === key))
          .map(([key, value]) => [key, String(value).slice(0, 500)]),
      );

      let guest = guestForReply(invitation.guests, { name, email, signedId: signedGuestId });

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

      // A typed name is not proof of identity, so it never renames an existing
      // row: only the holder of that guest's own link may change the name.
      if (signedGuestId) guest.name = name;
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

      if (status === 'yes' && !fitsCapacity(invitation, guest.id, size)) {
        throw new RsvpError(
          'Sorry — this event is full. Please reply no or contact the host directly.',
          409,
        );
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
    // Hand back a signature for the row this reply went into, so a correction
    // later in the same visit is recognised as that guest rather than starting a
    // second row. It grants nothing beyond the row the caller just wrote.
    const token = saved ? await guestToken(id, saved.id) : null;
    return gate.applyCookie(NextResponse.json({ guest: saved, guestToken: token }));
  } catch (error) {
    if (error instanceof RsvpError) {
      return gate.applyCookie(
        NextResponse.json({ error: error.message }, { status: error.status }),
      );
    }
    return gate.applyCookie(
      NextResponse.json({ error: 'Could not save your reply.' }, { status: 500 }),
    );
  }
}
