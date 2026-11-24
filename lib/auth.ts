import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPool } from './db';
import { planKey, type PlanKey } from './plan-caps';

export const SESSION_COOKIE = 'envelope_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const RESET_MINUTES = 30;

type UserRow = {
  id: string;
  name: string;
  email: string;
  salt: string;
  hash: string;
  created_at: Date;
  password_changed_at: Date;
  reset_hash: string | null;
  reset_expires: string | null;
  plan: string;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  sessionVersion: string;
  plan: PlanKey;
};

const iso = (value: Date | string) => new Date(value).toISOString();

function toPublic(row: UserRow): SessionUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: iso(row.created_at),
    // No plan, or one this build does not know, is the smallest plan.
    plan: planKey(row.plan),
    // Accounts made before sessions were versioned were signed with their
    // creation time, so that is what the import stores here too.
    sessionVersion: iso(row.password_changed_at),
  };
}

const digest = (password: string, salt: string) => scryptSync(password, salt, 64).toString('hex');
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export function validateSignup(input: {
  name?: string;
  email?: string;
  password?: string;
}): { error: string } | { name: string; email: string; password: string } {
  const name = (input.name ?? '').trim().slice(0, 60);
  const email = (input.email ?? '').trim().toLowerCase().slice(0, 200);
  const password = input.password ?? '';

  if (!name) return { error: 'Tell us your name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'That email does not look right.' };
  if (password.length < 8) return { error: 'Use at least 8 characters for the password.' };
  if (password.length > 200) return { error: 'That password is too long.' };

  return { name, email, password };
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters for the password.';
  if (password.length > 200) return 'That password is too long.';
  return null;
}

/** Creates the account, or returns null when the email is already taken. */
export async function createUser(
  name: string,
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const id = `user_${randomBytes(8).toString('hex')}`;
  const salt = randomBytes(16).toString('hex');
  const now = new Date();

  // The unique email index is what settles a race between two signups.
  const result = await getPool().query(
    `insert into users (id, name, email, salt, hash, created_at, password_changed_at)
     values ($1, $2, $3, $4, $5, $6, $6)
     on conflict (email) do nothing`,
    [id, name, email.trim().toLowerCase(), salt, digest(password, salt), now],
  );
  if (!result.rowCount) return null;

  return {
    id,
    name,
    email: email.trim().toLowerCase(),
    createdAt: now.toISOString(),
    sessionVersion: now.toISOString(),
    // The column's default, spelled out so a create cannot forget it.
    plan: 'note',
  };
}

export async function verifyUser(email: string, password: string): Promise<SessionUser | null> {
  const { rows } = await getPool().query<UserRow>('select * from users where email = $1', [
    email.trim().toLowerCase(),
  ]);
  const user = rows[0];
  if (!user) return null;

  const attempt = Buffer.from(digest(password, user.salt), 'hex');
  const expected = Buffer.from(user.hash, 'hex');
  if (attempt.length !== expected.length || !timingSafeEqual(attempt, expected)) return null;
  return toPublic(user);
}

export async function getUserById(id: string): Promise<SessionUser | null> {
  const { rows } = await getPool().query<UserRow>('select * from users where id = $1', [id]);
  return rows[0] ? toPublic(rows[0]) : null;
}

/** True while this account is the only one, used to adopt pre-account invitations. */
export async function isOnlyUser(userId: string): Promise<boolean> {
  const { rows } = await getPool().query<{ total: number; first: string | null }>(
    'select count(*)::int as total, min(id) as first from users',
  );
  return rows[0].total === 1 && rows[0].first === userId;
}

/**
 * A single-use link, valid for half an hour. Returns null when no account has
 * that email, so the route can answer without saying which.
 */
export async function createResetToken(email: string): Promise<string | null> {
  const token = randomBytes(24).toString('base64url');
  const result = await getPool().query(
    'update users set reset_hash = $2, reset_expires = $3 where email = $1',
    [email.trim().toLowerCase(), tokenHash(token), Date.now() + RESET_MINUTES * 60 * 1000],
  );
  return result.rowCount ? token : null;
}

export async function resetPassword(token: string, password: string): Promise<SessionUser | null> {
  const pool = getPool();
  const { rows } = await pool.query<UserRow>(
    `select * from users
      where reset_hash = $1 and reset_expires is not null and reset_expires > $2`,
    [tokenHash(token), Date.now()],
  );
  const user = rows[0];
  if (!user) return null;

  const salt = randomBytes(16).toString('hex');
  const changed = new Date();
  const { rows: updated } = await pool.query<UserRow>(
    `update users
        set salt = $2, hash = $3, password_changed_at = $4, reset_hash = null, reset_expires = null
      where id = $1
      returning *`,
    [user.id, salt, digest(password, salt), changed],
  );
  forgetUser(user.id);
  return updated[0] ? toPublic(updated[0]) : null;
}

// Kept on globalThis so `next dev` reloading this module does not throw the
// cached key away and re-query the database on the next request.
const globalForAuth = globalThis as typeof globalThis & {
  __gatherlySecret?: Promise<string> | null;
  __gatherlyUsers?: Map<string, { user: SessionUser | null; at: number }>;
};

/**
 * The signing key for session cookies, kept in the database so every instance
 * signs and verifies the same cookies and a restart cannot log everybody out.
 */
export function sessionSecret(): Promise<string> {
  const cachedSecret = globalForAuth.__gatherlySecret;
  if (cachedSecret) return cachedSecret;

  const pending = (async () => {
    const pool = getPool();
    const existing = await pool.query<{ value: string }>(
      "select value from app_settings where key = 'session_secret'",
    );
    if (existing.rows[0]?.value) return existing.rows[0].value;

    const value = randomBytes(32).toString('hex');
    // Another instance may create it first; whoever loses reads the winner.
    await pool.query(
      "insert into app_settings (key, value) values ('session_secret', $1) on conflict (key) do nothing",
      [value],
    );
    const stored = await pool.query<{ value: string }>(
      "select value from app_settings where key = 'session_secret'",
    );
    return stored.rows[0].value;
  })();

  // Never cache a failure: a database blip must not poison the secret for good.
  globalForAuth.__gatherlySecret = pending;
  pending.catch(() => {
    globalForAuth.__gatherlySecret = null;
  });
  return pending;
}

/**
 * Every request needs the signed-in user's row, and a remote database charges a
 * full round trip for each query, so one lookup is reused briefly. A deleted
 * account or a changed password therefore takes at most this long to bite; a
 * reset clears the entry straight away.
 */
const USER_TTL_MS = 15_000;

/**
 * Drops the cached row so the next read sees a change made elsewhere, such as a
 * payment recorded by the webhook or by the return from Checkout.
 */
export function forgetUser(id: string) {
  globalForAuth.__gatherlyUsers?.delete(id);
}

async function userForSession(id: string): Promise<SessionUser | null> {
  const cache = (globalForAuth.__gatherlyUsers ??= new Map());
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < USER_TTL_MS) return hit.user;

  const user = await getUserById(id);
  cache.set(id, { user, at: Date.now() });
  return user;
}

async function sign(payload: string): Promise<string> {
  const key = await sessionSecret();
  return createHmac('sha256', key).update(payload).digest('base64url');
}

function sameSignature(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function issueSession(userId: string, version: string): Promise<string> {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, sv: version, exp: Date.now() + SESSION_MAX_AGE * 1000 }),
  ).toString('base64url');
  return `${payload}.${await sign(payload)}`;
}

export async function readSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  if (!sameSignature(signature, await sign(payload))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid?: string;
      sv?: string;
      exp?: number;
    };
    if (!data.uid || !data.exp || Date.now() > data.exp) return null;
    const user = await userForSession(data.uid);
    // A reset changes the password version, which retires every older session.
    if (!user || user.sessionVersion !== data.sv) return null;
    return user;
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return readSession(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Server pages: anyone signed out is sent to the sign-in page. An optional
 * `next` keeps them on the page they asked for instead of the web home, so the
 * app returns to the app after signing in.
 */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) {
    const target = next && next.startsWith('/') && !next.startsWith('//') ? next : undefined;
    redirect(target ? `/signin?next=${encodeURIComponent(target)}` : '/signin');
  }
  return user;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  };
}
