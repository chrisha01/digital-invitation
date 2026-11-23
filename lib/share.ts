import { formatWhen } from './dates';
import type { Invitation } from './types';

/**
 * What a link to a guest page says when it is pasted somewhere else.
 *
 * A preview is written by the messaging app, not by us, so it has to work from
 * four short fields: a title, one or two lines of description and an image. The
 * guest list, replies and private notes are never part of it.
 */

/** Long text is clipped on a word boundary, never mid-word. */
export function clip(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** The event's own name, falling back to whatever the host called the card. */
export function shareTitle(invitation: Invitation): string {
  const title = (invitation.event?.title || invitation.title || '').trim();
  return clip(title, 90) || 'You are invited';
}

/** Host, when and where, then a line of the host's own words. */
export function shareDescription(invitation: Invitation): string {
  const event = invitation.event;
  const host = (event?.host ?? '').trim();
  const when = event?.startsAt ? formatWhen(event.startsAt) : '';
  const place = (event?.location ?? '').trim();
  const blurb = clip(event?.description ?? '', 140);

  const lines = [
    [host ? `Hosted by ${host}` : '', when, place].filter(Boolean).join(' · '),
    blurb,
  ].filter(Boolean);

  return lines.join(' — ') || 'Open the invitation to see the details and reply.';
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * The invitation's own colours for the preview image, with a neutral paper and
 * ink behind any value a card is allowed to leave blank.
 */
export function sharePalette(invitation: Invitation): {
  background: string;
  ink: string;
  accent: string;
} {
  const pick = (value: string | undefined, fallback: string) =>
    value && HEX.test(value) ? value : fallback;
  return {
    background: pick(invitation.card?.background, pick(invitation.page?.background, '#f7f2e7')),
    ink: pick(invitation.card?.ink, '#2b2a26'),
    accent: pick(invitation.card?.accent, '#9a7b4f'),
  };
}

/**
 * The public origin, needed for the absolute URLs a preview requires. `APP_URL`
 * is the same variable the scheduler already uses, so there is one place to set
 * it rather than a second one just for sharing.
 */
export function siteUrl(): URL | undefined {
  const raw = (process.env.APP_URL ?? '').trim();
  if (!raw) return undefined;
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
}
