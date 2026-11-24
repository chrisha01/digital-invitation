-- A checkout is recorded before the account's plan changes, so every upgrade
-- has a receipt and a delivery that arrives twice cannot upgrade twice.
--
-- The Stripe session id is the idempotency key: Stripe retries a webhook until
-- it is acknowledged, and a retry has to find the row the first delivery wrote.

create table if not exists purchases (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  plan        text not null check (plan in ('letter', 'suite')),
  amount      integer not null check (amount > 0),
  currency    text not null default 'gbp',
  provider    text not null default 'stripe',
  session_id  text not null unique,
  created_at  timestamptz not null default now()
);

create index if not exists purchases_user_idx on purchases (user_id, created_at desc);
