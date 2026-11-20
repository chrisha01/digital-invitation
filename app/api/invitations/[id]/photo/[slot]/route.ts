import { getInvitationImage } from '@/lib/store';

export const dynamic = 'force-dynamic';

const SLOTS = ['photo', 'portrait', 'backdrop'] as const;
type Slot = (typeof SLOTS)[number];

/**
 * Streams a picture that lives inline in the invitation document.
 *
 * Servers with object storage keep image URLs, and those never come here. This
 * exists for the fallback case, where the editor inlines a data URL: the guest
 * page then references this route instead of carrying the base64 itself, which
 * halves the page and makes repeat visits free. The `v` in the URL is the
 * invitation's last save, so the response can be cached for good.
 *
 * Only the slot itself is read out of the row — see getInvitationImage — since a
 * guest list grows every time somebody replies and the document also holds the
 * photo we are already serving.
 */

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string; slot: string }> },
) {
  const { id, slot } = await ctx.params;
  if (!SLOTS.includes(slot as Slot)) {
    return new Response('Not found', { status: 404 });
  }

  const value = await getInvitationImage(id, slot as Slot);
  const parsed = value ? /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(value) : null;
  if (!parsed) return new Response('Not found', { status: 404 });

  const [, contentType, base64, payload] = parsed;
  const bytes = base64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');

  return new Response(new Uint8Array(bytes), {
    headers: {
      'content-type': contentType,
      'content-length': String(bytes.byteLength),
      // The URL carries the invitation's updatedAt, so this version never changes.
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
}
