-- Plans live on the account. The key is all that is stored: what each plan
-- allows is code (lib/plan-caps.ts), so a new cap does not need a migration.
--
-- Order matters. The column is added nullable, existing accounts are backfilled
-- to the largest plan (they already have whatever invitations they have, and a
-- plan must never take one away), then the default and the constraint go on so
-- a re-run cannot upgrade an account that was deliberately put on Note.

alter table users add column if not exists plan text;

update users set plan = 'suite' where plan is null;

alter table users alter column plan set default 'note';
alter table users alter column plan set not null;

alter table users drop constraint if exists users_plan_check;
alter table users add constraint users_plan_check
  check (plan in ('note', 'letter', 'suite'));
