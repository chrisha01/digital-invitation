-- Invitations are stored as whole documents, exactly as the JSON store held
-- them, with the fields the app queries lifted into columns. Keeping the
-- document intact means the rest of the app keeps working unchanged; the
-- columns give us cheap listing, ordering and access checks.

create table if not exists invitations (
  id            text primary key,
  owner_id      text,
  title         text not null default '',
  design_slug   text not null default '',
  starts_at     timestamptz,
  created_at    timestamptz not null,
  updated_at    timestamptz not null,
  -- lowercased emails, so a co-host lookup is a simple array containment test
  collaborators text[] not null default '{}',
  document      jsonb not null
);

create index if not exists invitations_owner_updated_idx
  on invitations (owner_id, updated_at desc);

create index if not exists invitations_updated_idx
  on invitations (updated_at desc);

create index if not exists invitations_collaborators_idx
  on invitations using gin (collaborators);
