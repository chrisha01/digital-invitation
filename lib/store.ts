import { getPool } from './db';
import type { Invitation, InvitationSummary } from './types';

/**
 * Invitations live in Postgres as whole documents, with the fields the app
 * queries lifted into columns. Every export here keeps the signature it had when
 * the store was a JSON file, so callers did not change.
 */

type DocumentRow = { document: Invitation };

/**
 * Counts a list page needs, taken out of the document by Postgres.
 *
 * A document holds every guest and, when no bucket is configured, a base64
 * photo; reading whole documents just to show six numbers shipped hundreds of
 * kilobytes per invitation over the network on every visit to the home page or a
 * dashboard. This projection keeps the document on the server.
 */
const SUMMARY_COLUMNS = `
  id,
  coalesce(nullif(document->>'title', ''), nullif(document->'event'->>'title', ''), 'Untitled invitation') as title,
  document->>'designSlug' as design_slug,
  document->>'updatedAt' as updated_at,
  document->'event'->>'startsAt' as starts_at,
  document->'event'->>'location' as location,
  jsonb_array_length(coalesce(document->'guests', '[]'::jsonb)) as guest_count,
  coalesce(stats.yes_count, 0) as yes_count,
  coalesce(stats.maybe_count, 0) as maybe_count,
  coalesce(stats.checked_in, 0) as checked_in,
  coalesce(stats.headcount, 0) as headcount,
  coalesce(
    (select layer->>'text'
       from jsonb_array_elements(coalesce(document->'card'->'layers', '[]'::jsonb)) as layer
      where layer->>'name' = 'Hosts'
      limit 1),
    document->'event'->>'host'
  ) as preview`;

// The headcount rule from lib/checkin.ts: a yes counts as the people named, or
// the guest plus their plus-ones, whichever is more.
const SUMMARY_GUESTS = `
  left join lateral (
    select
      count(*) filter (where g->>'status' = 'yes') as yes_count,
      count(*) filter (where g->>'status' = 'maybe') as maybe_count,
      count(*) filter (where nullif(g->>'checkedInAt', '') is not null) as checked_in,
      coalesce(sum(
        case when g->>'status' = 'yes' then
          greatest(
            1,
            coalesce((g->>'adults')::int, 0) + coalesce((g->>'children')::int, 0),
            1 + coalesce((g->>'plusOnes')::int, 0)
          )
        else 0 end
      ), 0) as headcount
    from jsonb_array_elements(coalesce(document->'guests', '[]'::jsonb)) as g
  ) as stats on true`;

type SummaryRow = {
  id: string;
  title: string;
  design_slug: string;
  updated_at: string;
  starts_at: string | null;
  location: string | null;
  guest_count: number;
  yes_count: string;
  maybe_count: string;
  checked_in: string;
  headcount: string;
  preview: string | null;
};

function toSummary(row: SummaryRow): InvitationSummary {
  return {
    id: row.id,
    title: row.title,
    designSlug: row.design_slug,
    updatedAt: row.updated_at,
    startsAt: row.starts_at ?? '',
    location: row.location ?? '',
    guestCount: Number(row.guest_count),
    yesCount: Number(row.yes_count),
    maybeCount: Number(row.maybe_count),
    checkedIn: Number(row.checked_in),
    headcount: Number(row.headcount),
    preview: row.preview ?? '',
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
  const sql = `select ${SUMMARY_COLUMNS} from invitations ${SUMMARY_GUESTS}`;
  const { rows } = ownerId
    ? await pool.query<SummaryRow>(`${sql} where owner_id = $1 order by updated_at desc`, [ownerId])
    : await pool.query<SummaryRow>(`${sql} order by updated_at desc`);
  return rows.map(toSummary);
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

/** Every image URL any invitation references, for the orphan sweep. */
export async function listImageUrls(): Promise<string[]> {
  const { rows } = await getPool().query<{ url: string | null }>(
    `select distinct url from (
       select document->'card'->>'photo' as url from invitations
       union all select document->'card'->>'portrait' from invitations
       union all select document->'backdrop'->>'image' from invitations
     ) urls
     where url is not null`,
  );
  return rows.map((row) => row.url).filter((url): url is string => Boolean(url));
}

/** Whether any invitation still points at this uploaded image. */
export async function isImageReferenced(url: string): Promise<boolean> {
  const { rows } = await getPool().query(
    `select 1 from invitations
      where document->'card'->>'photo' = $1
         or document->'card'->>'portrait' = $1
         or document->'backdrop'->>'image' = $1
      limit 1`,
    [url],
  );
  return rows.length > 0;
}

/** Invitations where this email is a co-host but not the owner. */
export async function listSharedInvitations(email: string): Promise<InvitationSummary[]> {
  const { rows } = await getPool().query<SummaryRow>(
    `select ${SUMMARY_COLUMNS} from invitations ${SUMMARY_GUESTS}
      where owner_id is not null
        and collaborators @> array[$1::text]
      order by updated_at desc`,
    [email.toLowerCase()],
  );
  return rows.map(toSummary);
}
