import { promises as fs } from 'node:fs';
import path from 'node:path';
import { dataDir } from './paths';
import type { Invitation, InvitationSummary } from './types';

const storeFile = () => path.join(dataDir(), 'invitations.json');

type DB = { invitations: Record<string, Invitation> };

let writeChain: Promise<unknown> = Promise.resolve();

/** Moves an unreadable store aside so the next write cannot destroy it. */
async function quarantine(): Promise<void> {
  const file = storeFile();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.rename(file, `${file}.unreadable-${stamp}`).catch(() => undefined);
}

async function load(): Promise<DB> {
  let raw: string;
  try {
    raw = await fs.readFile(storeFile(), 'utf8');
  } catch (error) {
    // A missing file is a first run; anything else means the store cannot be read.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') await quarantine();
    return { invitations: {} };
  }

  try {
    const parsed = JSON.parse(raw) as DB;
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.invitations &&
      typeof parsed.invitations === 'object'
    ) {
      return parsed;
    }
  } catch {
    // Fall through: unparseable JSON is corruption, not an empty store.
  }

  // Keep the damaged file instead of letting the next save overwrite every invitation.
  await quarantine();
  return { invitations: {} };
}

async function persist(db: DB): Promise<void> {
  const file = storeFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

/** Serialises read-modify-write cycles so concurrent requests cannot clobber each other. */
function queued<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.catch(() => undefined);
  return run;
}

const headsOf = (guest: { status: string; adults: number; children: number; plusOnes: number }) =>
  guest.status === 'yes' ? Math.max(1, guest.adults + guest.children, 1 + guest.plusOnes) : 0;

function summarise(inv: Invitation): InvitationSummary {
  return {
    id: inv.id,
    title: inv.title || inv.event.title || 'Untitled invitation',
    designSlug: inv.designSlug,
    updatedAt: inv.updatedAt,
    startsAt: inv.event.startsAt,
    location: inv.event.location,
    guestCount: inv.guests.length,
    yesCount: inv.guests.filter((g) => g.status === 'yes').length,
    maybeCount: inv.guests.filter((g) => g.status === 'maybe').length,
    checkedIn: inv.guests.filter((g) => g.checkedInAt).length,
    headcount: inv.guests.reduce((sum, g) => sum + headsOf(g), 0),
    preview: inv.card.layers.find((l) => l.name === 'Hosts')?.text ?? inv.event.host,
  };
}

export async function listInvitations(ownerId?: string): Promise<InvitationSummary[]> {
  const db = await load();
  return Object.values(db.invitations)
    .filter((inv) => !ownerId || inv.ownerId === ownerId)
    .map(summarise)
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
    .map(summarise)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
