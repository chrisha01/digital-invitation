import { createHmac, timingSafeEqual } from 'node:crypto';
import { sessionSecret } from './auth';

/**
 * A personal link names one guest, and the id on its own cannot do that: the
 * guest id is printed in every entry pass and was, until the guest page was
 * reduced to a projection, in the public page's payload. So the link carries a
 * signature over the invitation and guest pair, and the reply endpoint only
 * trusts an id that arrives with a signature this server issued.
 *
 * Nothing here is user input: the key is the same session secret the cookies
 * are signed with, so a token survives a restart and works on every instance.
 */
const scope = (invitationId: string, guestId: string) => `guest:${invitationId}:${guestId}`;

export async function guestToken(invitationId: string, guestId: string): Promise<string> {
  const secret = await sessionSecret();
  return createHmac('sha256', secret).update(scope(invitationId, guestId)).digest('base64url').slice(0, 22);
}

export async function verifyGuestToken(
  invitationId: string,
  guestId: string,
  token: string | null | undefined,
): Promise<boolean> {
  if (!token) return false;
  const expected = Buffer.from(await guestToken(invitationId, guestId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The link a guest is sent: their own page, complete with their entry pass. */
export async function guestLink(
  origin: string,
  invitationId: string,
  guestId: string,
): Promise<string> {
  const token = await guestToken(invitationId, guestId);
  return `${origin}/i/${invitationId}?g=${encodeURIComponent(guestId)}&t=${token}`;
}

/** Tokens for a whole guest list at once, for the host's copy-link buttons. */
export async function guestTokens(
  invitationId: string,
  guestIds: string[],
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    guestIds.map(async (guestId) => [guestId, await guestToken(invitationId, guestId)] as const),
  );
  return Object.fromEntries(entries);
}
