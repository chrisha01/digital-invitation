import { getPool } from './db';
import type { Invitation, InvitationSummary } from './types';

/**
 * Invitations live in Postgres as whole documents, with the fields the app
 * queries lifted into columns. Every export here keeps the signature it had when
 * the store was a JSON file, so callers did not change.
 */

type DocumentRow = { document: Invitation };

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

/** The column values that mirror a stored document. */
function columns(inv: Invitation) {
  const starts = inv.event?.startsAt ? new Date(inv.event.startsAt) : null;
  const now = new Date().toISOString();
  return {
    id: inv.id,
    ownerId: inv.ownerId ?? null,
    title: inv.title ?? '',
    designSlug: inv.designSlug ?? '',
    startsAt: starts && !Number.isNaN(starts.getTime()) ? starts.toISOString() : null,
    createdAt: inv.createdAt || now,
    updatedAt: inv.updatedAt || now,
    collaborators: (inv.collaborators ?? []).map((entry) => entry.toLowerCase()),
    document: inv,
  };
}

const UPSERT = `
  insert into invitations
    (id, owner_id, title, design_slug, starts_at, created_at, updated_at, collaborators, document)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  on conflict (id) do update set
    owner_id = excluded.owner_id,
    title = excluded.title,
    design_slug = excluded.design_slug,
    starts_at = excluded.starts_at,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    collaborators = excluded.collaborators,
    document = excluded.document
`;

function upsertValues(inv: Invitation) {
  const c = columns(inv);
  return [
    c.id,
    c.ownerId,
    c.title,
    c.designSlug,
    c.startsAt,
    c.createdAt,
    c.updatedAt,
    c.collaborators,
    c.document,
  ];
}

export async function listInvitations(ownerId?: string): Promise<InvitationSummary[]> {
  const pool = getPool();
  const { rows } = ownerId
    ? await pool.query<DocumentRow>(
        'select document from invitations where owner_id = $1 order by updated_at desc',
        [ownerId],
      )
    : await pool.query<DocumentRow>('select document from invitations order by updated_at desc');
  return rows.map((row) => summarise(row.document));
}

export async function getInvitation(id: string): Promise<Invitation | null> {
  const { rows } = await getPool().query<DocumentRow>(
    'select document from invitations where id = $1',
    [id],
  );
  return rows[0]?.document ?? null;
}

export async function putInvitation(invitation: Invitation): Promise<Invitation> {
  await getPool().query(UPSERT, upsertValues(invitation));
  return invitation;
}

export async function deleteInvitation(id: string): Promise<void> {
  await getPool().query('delete from invitations where id = $1', [id]);
}

/**
 * Reads the document, applies the change and writes it back inside one
 * transaction with the row locked, so two requests cannot lose each other's
 * edits the way the in-process queue had to prevent.
 */
export async function mutateInvitation(
  id: string,
  mutate: (invitation: Invitation) => void,
): Promise<Invitation | null> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const { rows } = await client.query<DocumentRow>(
      'select document from invitations where id = $1 for update',
      [id],
    );
    const existing = rows[0]?.document;
    if (!existing) {
      await client.query('rollback');
      return null;
    }

    mutate(existing);
    existing.updatedAt = new Date().toISOString();

    const values = upsertValues(existing);
    await client.query(UPSERT, values);
    await client.query('commit');
    return existing;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Adopts invitations created before accounts existed; first account only. */
export async function claimOrphanInvitations(ownerId: string): Promise<number> {
  const { rows } = await getPool().query<{ id: string }>(
    `update invitations
        set owner_id = $1,
            document = jsonb_set(document, '{ownerId}', to_jsonb($1::text))
      where owner_id is null
      returning id`,
    [ownerId],
  );
  return rows.length;
}

/** Invitations where this email is a co-host but not the owner. */
export async function listSharedInvitations(email: string): Promise<InvitationSummary[]> {
  const { rows } = await getPool().query<DocumentRow>(
    `select document from invitations
      where owner_id is not null
        and collaborators @> array[$1::text]
      order by updated_at desc`,
    [email.toLowerCase()],
  );
  return rows.map((row) => summarise(row.document));
}
