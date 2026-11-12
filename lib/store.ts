import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Invitation, InvitationSummary } from './types';

const DIR = path.join(process.cwd(), '.data');
const FILE = path.join(DIR, 'invitations.json');

type DB = { invitations: Record<string, Invitation> };

let writeChain: Promise<unknown> = Promise.resolve();

async function load(): Promise<DB> {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw) as DB;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.invitations !== 'object') {
      return { invitations: {} };
    }
    return parsed;
  } catch {
    return { invitations: {} };
  }
}

async function persist(db: DB): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, FILE);
}

/** Serialises read-modify-write cycles so concurrent requests cannot clobber each other. */
function queued<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.catch(() => undefined);
  return run;
}

export async function listInvitations(ownerId?: string): Promise<InvitationSummary[]> {
  const db = await load();
  return Object.values(db.invitations)
    .filter((inv) => !ownerId || inv.ownerId === ownerId)
    .map((inv) => ({
      id: inv.id,
      title: inv.title || inv.event.title || 'Untitled invitation',
      designSlug: inv.designSlug,
      updatedAt: inv.updatedAt,
      guestCount: inv.guests.length,
      yesCount: inv.guests.filter((g) => g.status === 'yes').length,
      preview: inv.card.layers.find((l) => l.name === 'Hosts')?.text ?? inv.event.host,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getInvitation(id: string): Promise<Invitation | null> {
  const db = await load();
  return db.invitations[id] ?? null;
}

export async function putInvitation(invitation: Invitation): Promise<Invitation> {
  return queued(async () => {
    const db = await load();
    db.invitations[invitation.id] = invitation;
    await persist(db);
    return invitation;
  });
}

export async function deleteInvitation(id: string): Promise<void> {
  return queued(async () => {
    const db = await load();
    delete db.invitations[id];
    await persist(db);
  });
}

export async function mutateInvitation(
  id: string,
  mutate: (invitation: Invitation) => void,
): Promise<Invitation | null> {
  return queued(async () => {
    const db = await load();
    const existing = db.invitations[id];
    if (!existing) return null;
    mutate(existing);
    existing.updatedAt = new Date().toISOString();
    db.invitations[id] = existing;
    await persist(db);
    return existing;
  });
}

/** Adopts invitations created before accounts existed; first account only. */
export async function claimOrphanInvitations(ownerId: string): Promise<number> {
  return queued(async () => {
    const db = await load();
    let claimed = 0;
    for (const invitation of Object.values(db.invitations)) {
      if (!invitation.ownerId) {
        invitation.ownerId = ownerId;
        claimed += 1;
      }
    }
    if (claimed) await persist(db);
    return claimed;
  });
}

/** Invitations where this email is a co-host but not the owner. */
export async function listSharedInvitations(email: string): Promise<InvitationSummary[]> {
  const db = await load();
  const wanted = email.toLowerCase();
  return Object.values(db.invitations)
    .filter(
      (inv) =>
        inv.ownerId &&
        (inv.collaborators ?? []).some((entry) => entry.toLowerCase() === wanted),
    )
    .map((inv) => ({
      id: inv.id,
      title: inv.title || inv.event.title || 'Untitled invitation',
      designSlug: inv.designSlug,
      updatedAt: inv.updatedAt,
      guestCount: inv.guests.length,
      yesCount: inv.guests.filter((g) => g.status === 'yes').length,
      preview: inv.card.layers.find((l) => l.name === 'Hosts')?.text ?? inv.event.host,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
