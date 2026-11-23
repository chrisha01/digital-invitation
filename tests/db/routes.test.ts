import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Next's data cache only exists inside a request; the store clears it after a
// write. Everything this file tests happens before that call.
vi.mock('next/cache', () => ({ revalidateTag: () => {}, unstable_cache: (fn: unknown) => fn }));

import InvitationPage, { generateMetadata } from '@/app/i/[id]/page';
import { GuestCard } from '@/app/i/[id]/guest-card';
import { POST as rsvp } from '@/app/api/invitations/[id]/rsvp/route';
import { getPool } from '@/lib/db';
import { buildInvitation } from '@/lib/defaults';
import { guestToken } from '@/lib/guest-token';
import type { GuestFacingInvitation, GuestPageViewer } from '@/lib/guest-view';
import type { Guest, Invitation } from '@/lib/types';

const connection = process.env.DATABASE_URL?.trim() ?? '';
const database = (() => {
  try {
    return new URL(connection).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();

// These tests empty the invitations table, so they may only ever point at a
// database that is obviously disposable.
if (!database.endsWith('_test')) {
  throw new Error(
    `Refusing to run the database tests against "${database || 'no database'}". ` +
      'Set DATABASE_URL to a database whose name ends in _test, apply db/migrations, and run again.',
  );
}

const INSERT = `
  insert into invitations
    (id, owner_id, title, design_slug, starts_at, created_at, updated_at, collaborators, document)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
`;

function guest(id: string, name: string, over: Partial<Guest> = {}): Guest {
  return {
    id,
    name,
    email: '',
    tag: '',
    status: 'invited',
    plusOnes: 0,
    adults: 0,
    children: 0,
    answers: {},
    message: '',
    respondedAt: null,
    ...over,
  };
}

/** A stored invitation with two guests on the list and replies open. */
async function seed(over: Partial<Invitation> = {}): Promise<Invitation> {
  const invitation: Invitation = {
    ...buildInvitation(),
    event: {
      ...buildInvitation().event,
      title: 'A Late-Summer Supper',
      host: 'Amelia & Jonah',
      startsAt: '2027-09-11T19:00',
    },
    guests: [guest('guest_ada', 'Ada Lovelace'), guest('guest_grace', 'Grace Hopper')],
    ...over,
  };
  invitation.createdAt = '2026-01-01T00:00:00.000Z';
  invitation.updatedAt = '2026-01-01T00:00:00.000Z';

  await getPool().query(INSERT, [
    invitation.id,
    null,
    invitation.title,
    invitation.designSlug,
    invitation.event.startsAt,
    invitation.createdAt,
    invitation.updatedAt,
    [],
    invitation,
  ]);
  return invitation;
}

async function stored(id: string): Promise<Invitation> {
  const { rows } = await getPool().query<{ document: Invitation }>(
    'select document from invitations where id = $1',
    [id],
  );
  return rows[0].document;
}

function reply(id: string, body: Record<string, unknown>) {
  return new Request(`http://localhost/api/invitations/${id}/rsvp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function post(id: string, body: Record<string, unknown>) {
  return rsvp(reply(id, body), { params: Promise.resolve({ id }) });
}

type Card = { inv: GuestFacingInvitation; viewer: GuestPageViewer };

async function card(invitation: Invitation, g?: string, t?: string): Promise<Card> {
  const element = (await GuestCard({
    invitation,
    id: invitation.id,
    g,
    t,
  })) as unknown as { props: Card };
  return element.props;
}

beforeEach(async () => {
  await getPool().query('truncate table invitations');
});

afterAll(async () => {
  await getPool().end();
});

describe('guest page link access', () => {
  it('answers an unknown invitation with a 404, not an empty card', async () => {
    await expect(
      InvitationPage({
        params: Promise.resolve({ id: 'inv_missing' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toMatchObject({ digest: expect.stringContaining('404') });
    await expect(generateMetadata({ params: Promise.resolve({ id: 'inv_missing' }) })).resolves.toEqual(
      { title: 'Invitation not found' },
    );
  });

  it('describes a real invitation from its public fields', async () => {
    const invitation = await seed();
    const meta = await generateMetadata({ params: Promise.resolve({ id: invitation.id }) });
    expect(meta.title).toBe('A Late-Summer Supper');
    expect(meta.description?.startsWith('Hosted by Amelia & Jonah · ')).toBe(true);
  });

  it('gives a signed personal link its guest, pass and reply token', async () => {
    const invitation = await seed();
    const viewed = await card(
      invitation,
      'guest_ada',
      await guestToken(invitation.id, 'guest_ada'),
    );

    expect(viewed.viewer.guest?.id).toBe('guest_ada');
    expect(viewed.viewer.name).toBe('Ada Lovelace');
    expect(viewed.viewer.token).toBe(await guestToken(invitation.id, 'guest_ada'));
    expect(viewed.viewer.passSvg).toContain('<svg');
    expect(viewed.viewer.linkExpired).toBe(false);
  });

  it('does not trust a guest id without a signature', async () => {
    const invitation = await seed();
    const viewed = await card(invitation, 'guest_ada');

    expect(viewed.viewer.guest).toBeNull();
    expect(viewed.viewer.name).toBeNull();
    expect(viewed.viewer.token).toBeNull();
    expect(viewed.viewer.passSvg).toBeNull();
    expect(viewed.viewer.linkExpired).toBe(true);
  });

  it('rejects a token minted for another invitation', async () => {
    const invitation = await seed();
    const other = await seed();
    const viewed = await card(
      invitation,
      'guest_ada',
      await guestToken(other.id, 'guest_ada'),
    );

    expect(viewed.viewer.guest).toBeNull();
    expect(viewed.viewer.linkExpired).toBe(true);
  });

  it('marks a signed link to a guest who is no longer on the list', async () => {
    const invitation = await seed({ guests: [guest('guest_grace', 'Grace Hopper')] });
    const viewed = await card(
      invitation,
      'guest_ada',
      await guestToken(invitation.id, 'guest_ada'),
    );

    expect(viewed.viewer.guest).toBeNull();
    expect(viewed.viewer.linkExpired).toBe(true);
  });

  it('shows an anonymous visitor only the projected card', async () => {
    const invitation = await seed({
      settings: { ...buildInvitation().settings, showGuestList: false },
      guests: [
        guest('guest_ada', 'Ada Lovelace', {
          email: 'ada@example.com',
          message: 'Cannot wait',
          status: 'yes',
        }),
        guest('guest_grace', 'Grace Hopper', { status: 'yes' }),
      ],
    });
    const viewed = await card(invitation);

    expect(viewed.viewer).toEqual({
      guest: null,
      name: null,
      token: null,
      passSvg: null,
      linkExpired: false,
    });
    // The guest list is hidden by the host's setting, and no contact details or
    // replies are serialised into the page at all.
    expect(viewed.inv.guestNames).toEqual([]);
    expect(viewed.inv).not.toHaveProperty('guests');
    expect(JSON.stringify(viewed.inv)).not.toContain('ada@example.com');
    expect(JSON.stringify(viewed.inv)).not.toContain('Cannot wait');
  });

  it('shows confirmed names when the host allows a guest list, and none for a maybe', async () => {
    const invitation = await seed({
      settings: { ...buildInvitation().settings, showGuestList: true },
      guests: [
        guest('guest_ada', 'Ada Lovelace', { status: 'yes' }),
        guest('guest_grace', 'Grace Hopper', { status: 'maybe' }),
      ],
    });
    const viewed = await card(invitation);
    expect(viewed.inv.guestNames).toEqual(['Ada Lovelace']);
  });
});

describe('rsvp endpoint authorization', () => {
  it('answers an unknown invitation with 404', async () => {
    const response = await post('inv_missing', { name: 'Ada', attending: 'yes' });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Invitation not found' });
  });

  it('refuses a reply after the deadline and leaves the row alone', async () => {
    const invitation = await seed({
      settings: { ...buildInvitation().settings, deadline: '2020-01-01T00:00' },
    });
    const response = await post(invitation.id, {
      name: 'Ada Lovelace',
      attending: 'yes',
      guestId: 'guest_ada',
      guestToken: await guestToken(invitation.id, 'guest_ada'),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'RSVPs for this event have closed.',
    });
    const saved = await stored(invitation.id);
    expect(saved.guests.find((row) => row.id === 'guest_ada')?.status).toBe('invited');
  });

  it('refuses a reply when the host turned replies off', async () => {
    const invitation = await seed({
      settings: { ...buildInvitation().settings, collectRsvp: false },
    });
    const response = await post(invitation.id, { name: 'Ada', attending: 'yes' });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'This invitation is not collecting RSVPs.',
    });
  });

  it('writes the row a signed personal link names', async () => {
    const invitation = await seed();
    const response = await post(invitation.id, {
      name: 'Ada L.',
      attending: 'yes',
      guestId: 'guest_ada',
      guestToken: await guestToken(invitation.id, 'guest_ada'),
    });

    expect(response.status).toBe(200);
    const saved = await stored(invitation.id);
    expect(saved.guests.find((row) => row.id === 'guest_ada')).toMatchObject({
      name: 'Ada L.',
      status: 'yes',
    });
    // The reply returns a signature, so a correction in the same visit stays on
    // this row rather than starting a second one.
    const { guestToken: returned } = await response.json();
    expect(returned).toBeTruthy();
  });

  it('never claims a row from a bare guest id', async () => {
    const invitation = await seed();
    const response = await post(invitation.id, {
      name: 'Someone Else',
      attending: 'no',
      guestId: 'guest_ada',
    });

    expect(response.status).toBe(200);
    const { guest: savedGuest } = (await response.json()) as { guest: Guest };
    expect(savedGuest.id).not.toBe('guest_ada');

    const saved = await stored(invitation.id);
    const ada = saved.guests.find((row) => row.id === 'guest_ada');
    expect(ada).toMatchObject({ status: 'invited', respondedAt: null });
    expect(saved.guests).toHaveLength(3);
  });

  it('rejects a token minted for a different invitation', async () => {
    const invitation = await seed();
    const other = await seed();
    const response = await post(invitation.id, {
      name: 'Someone Else',
      attending: 'no',
      guestId: 'guest_ada',
      guestToken: await guestToken(other.id, 'guest_ada'),
    });

    expect(response.status).toBe(200);
    const { guest: savedGuest } = (await response.json()) as { guest: Guest };
    expect(savedGuest.id).not.toBe('guest_ada');
  });

  it('asks for a name and a choice before touching the database', async () => {
    const invitation = await seed();
    await expect(post(invitation.id, { attending: 'yes' })).resolves.toMatchObject({ status: 400 });
    await expect(post(invitation.id, { name: 'Ada', attending: 'later' })).resolves.toMatchObject({
      status: 400,
    });
  });
});
