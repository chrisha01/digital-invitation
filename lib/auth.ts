import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const DIR = path.join(process.cwd(), '.data');
const USERS_FILE = path.join(DIR, 'users.json');
const SECRET_FILE = path.join(DIR, 'session-secret');

export const SESSION_COOKIE = 'envelope_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const RESET_MINUTES = 30;

type StoredUser = {
  id: string;
  name: string;
  email: string;
  salt: string;
  hash: string;
  createdAt: string;
  /** bumped on password change, so old sessions stop working */
  passwordChangedAt: string;
  resetHash?: string;
  resetExpires?: number;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  sessionVersion: string;
};

type UsersDB = { users: StoredUser[] };

let chain: Promise<unknown> = Promise.resolve();
function queued<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

async function loadUsers(): Promise<UsersDB> {
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as UsersDB;
    if (!parsed || !Array.isArray(parsed.users)) return { users: [] };
    return parsed;
  } catch {
    return { users: [] };
  }
}

async function saveUsers(db: UsersDB): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = `${USERS_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, USERS_FILE);
}

const digest = (password: string, salt: string) => scryptSync(password, salt, 64).toString('hex');
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

function toPublic(user: StoredUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    // Accounts made before sessions were versioned keep working until reset.
    sessionVersion: user.passwordChangedAt ?? user.createdAt,
  };
}

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
  return queued(async () => {
    const db = await loadUsers();
    if (db.users.some((user) => user.email === email)) return null;
    const salt = randomBytes(16).toString('hex');
    const user: StoredUser = {
      id: `user_${randomBytes(8).toString('hex')}`,
      name,
      email,
      salt,
      hash: digest(password, salt),
      createdAt: new Date().toISOString(),
      passwordChangedAt: new Date().toISOString(),
    };
    db.users.push(user);
    await saveUsers(db);
    return toPublic(user);
  });
}

export async function verifyUser(email: string, password: string): Promise<SessionUser | null> {
  const db = await loadUsers();
  const user = db.users.find((candidate) => candidate.email === email.trim().toLowerCase());
  if (!user) return null;

  const attempt = Buffer.from(digest(password, user.salt), 'hex');
  const expected = Buffer.from(user.hash, 'hex');
  if (attempt.length !== expected.length || !timingSafeEqual(attempt, expected)) return null;
  return toPublic(user);
}

export async function getUserById(id: string): Promise<SessionUser | null> {
  const db = await loadUsers();
  const user = db.users.find((candidate) => candidate.id === id);
  return user ? toPublic(user) : null;
}

/** True while this account is the only one, used to adopt pre-account invitations. */
export async function isOnlyUser(userId: string): Promise<boolean> {
  const db = await loadUsers();
  return db.users.length === 1 && db.users[0].id === userId;
}

/**
 * A single-use link, valid for half an hour. Returns null when no account has
 * that email, so the route can answer without saying which.
 */
export async function createResetToken(email: string): Promise<string | null> {
  return queued(async () => {
    const db = await loadUsers();
    const user = db.users.find((candidate) => candidate.email === email.trim().toLowerCase());
    if (!user) return null;

    const token = randomBytes(24).toString('base64url');
    user.resetHash = tokenHash(token);
    user.resetExpires = Date.now() + RESET_MINUTES * 60 * 1000;
    await saveUsers(db);
    return token;
  });
}

export async function resetPassword(token: string, password: string): Promise<SessionUser | null> {
  return queued(async () => {
    const db = await loadUsers();
    const hash = tokenHash(token);
    const user = db.users.find(
      (candidate) =>
        candidate.resetHash === hash &&
        typeof candidate.resetExpires === 'number' &&
        candidate.resetExpires > Date.now(),
    );
    if (!user) return null;

    const salt = randomBytes(16).toString('hex');
    user.salt = salt;
    user.hash = digest(password, salt);
    user.passwordChangedAt = new Date().toISOString();
    delete user.resetHash;
    delete user.resetExpires;
    await saveUsers(db);
    return toPublic(user);
  });
}

let cachedSecret: Promise<string> | null = null;

export function sessionSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  cachedSecret = (async () => {
    try {
      const existing = (await fs.readFile(SECRET_FILE, 'utf8')).trim();
      if (existing) return existing;
    } catch {
      // Fall through and create one.
    }
    const value = randomBytes(32).toString('hex');
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(SECRET_FILE, value, 'utf8');
    return value;
  })();
  return cachedSecret;
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
    const user = await getUserById(data.uid);
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

/** Server pages: anyone signed out is sent to the sign-in page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect('/signin');
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
