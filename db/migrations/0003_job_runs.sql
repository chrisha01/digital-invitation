-- What each background job did, kept next to the data so the history survives
-- restarts and is visible from psql as well as the host's stdout.

create table if not exists job_runs (
  id         bigserial primary key,
  job        text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  status     text not null,
  scanned    integer not null default 0,
  referenced integer not null default 0,
  -- array of object keys removed by this run
  deleted    jsonb not null default '[]'::jsonb,
  error      text
);

create index if not exists job_runs_recent_idx on job_runs (job, started_at desc);
