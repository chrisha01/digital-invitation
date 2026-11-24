import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Next's data cache only exists inside a request; the store clears it after a
// write. Everything here happens before that call.
vi.mock('next/cache', () => ({ revalidateTag: () => {}, unstable_cache: (fn: unknown) => fn }));

// The create route asks who is signed in; these tests drive it directly.
vi.mock('@/lib/auth', () => ({ currentUser: vi.fn() }));

import { POST } from '@/app/api/invitations/route';
import { currentUser, type SessionUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { buildInvitation } from '@/lib/defaults';
import { PLAN_CAPS, type PlanKey } from '@/lib/plan-caps';
import {
  deleteInvitation,
  getInvitation,
  mutateInvitation,
  putInvitationWithinCap,
} from '@/lib/store';
import type { Invitation } from '@/lib/types';

const connection = process.env.DATABASE_URL?.trim() ?? '';
const database = (() => {
  try {
    return new URL(connection).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();

// These tests write accounts, so they may only ever point at a database that is
// obviously disposable.
if (!database.endsWith('_test')) {
  throw new Error(
    `Refusing to run the plan tests against "${database || 'no database'}". ` +
      'Set DATABASE_URL to a database whose name ends in _test, apply db/migrations, and run again.',
  );
}

let counter = 0;

/** An account on the plan, written straight to the table the route reads. */
async function makeUser(plan: PlanKey): Promise<SessionUser> {
  counter += 1;
  const id = `user_plantest_${Date.now()}_${counter}`;
  const email = `${id}@plan-test.invalid`;
  const now = new Date().toISOString();

  await getPool().query(
    `insert into users (id, name, email, salt, hash, created_at, password_changed_at, plan)
     values ($1, $2, $3, 'salt', 'hash', $4, $4, $5)`,
    [id, 'Plan Test', email, now, plan],
  );

  return { id, name: 'Plan Test', email, createdAt: now, sessionVersion: now, plan };
}

/** One create, the way the route does it. Null means the cap refused it. */
async function attempt(user: SessionUser): Promise<Invitation | null> {
  const invitation = buildInvitation();
  invitation.ownerId = user.id;
  const created = await putInvitationWithinCap(invitation, PLAN_CAPS[user.plan]);
  return created ? invitation : null;
}

async function owned(user: SessionUser): Promise<number> {
  const { rows } = await getPool().query<{ total: number }>(
    'select count(*)::int as total from invitations where owner_id = $1',
    [user.id],
  );
  return rows[0].total;
}

function createRequest(): Request {
  return new Request('http://localhost/api/invitations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
}

beforeEach(async () => {
  const pool = getPool();
  await pool.query("delete from invitations where owner_id like 'user_plantest_%'");
  await pool.query("delete from users where id like 'user_plantest_%'");
});

afterAll(async () => {
  await getPool().end();
});

describe('the invitation cap', () => {
  it('stops a Note account at one invitation', async () => {
    const user = await makeUser('note');

    expect(await attempt(user)).not.toBeNull();
    expect(await attempt(user)).toBeNull();
    expect(await owned(user)).toBe(1);
  });

  it('frees a slot when an invitation is deleted', async () => {
    const user = await makeUser('note');
    const first = await attempt(user);
    expect(first).not.toBeNull();
    expect(await attempt(user)).toBeNull();

    await deleteInvitation(first!.id);

    expect(await attempt(user)).not.toBeNull();
    expect(await owned(user)).toBe(1);
  });

  it('lets a Letter account hold three and no more', async () => {
    const user = await makeUser('letter');

    for (let index = 0; index < 3; index += 1) expect(await attempt(user)).not.toBeNull();
    expect(await attempt(user)).toBeNull();
    expect(await owned(user)).toBe(3);
  });

  it('does not let two simultaneous taps jump the last slot', async () => {
    const user = await makeUser('note');
    const results = await Promise.all([attempt(user), attempt(user)]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await owned(user)).toBe(1);
  });

  it('leaves everything an over-cap account already has alone', async () => {
    const suite = await makeUser('suite');

    const made: Invitation[] = [];
    for (let index = 0; index < 4; index += 1) {
      const invitation = await attempt(suite);
      expect(invitation).not.toBeNull();
      made.push(invitation!);
    }

    // Downgraded after the invitations exist: reading and editing still work,
    // only the next create is refused.
    const note: SessionUser = { ...suite, plan: 'note' };
    expect(await attempt(note)).toBeNull();

    await mutateInvitation(made[0].id, (invitation) => {
      invitation.title = 'Renamed after the downgrade';
    });
    expect((await getInvitation(made[0].id))?.title).toBe('Renamed after the downgrade');
    expect(await owned(suite)).toBe(4);
  });
});

describe('the create route', () => {
  it('creates once, then refuses with the plan and the cap', async () => {
    const user = await makeUser('note');
    vi.mocked(currentUser).mockResolvedValue(user);

    const first = await POST(createRequest());
    expect(first.status).toBe(201);

    const second = await POST(createRequest());
    expect(second.status).toBe(403);
    const body = (await second.json()) as { error: string; plan: string; cap: number };
    expect(body.plan).toBe('note');
    expect(body.cap).toBe(1);
    expect(body.error).toMatch(/Note plan holds 1 invitation/);
  });

  it('turns a signed-out create away before counting anything', async () => {
    vi.mocked(currentUser).mockResolvedValue(null);

    const response = await POST(createRequest());
    expect(response.status).toBe(401);
  });
});
