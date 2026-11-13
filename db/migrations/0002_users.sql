-- Accounts move out of .data/users.json. Passwords stay scrypt-hashed in Node;
-- this table only stores the salt, the hash and the timestamps the session cookie
-- is validated against.

create table if not exists users (
  id                  text primary key,
  name                text not null,
  -- always stored lowercased; the unique index is what stops duplicate signups
  email               text not null,
  salt                text not null,
  hash                text not null,
  created_at          timestamptz not null,
  -- bumped on password change, so older session cookies stop being valid
  password_changed_at timestamptz not null,
  reset_hash          text,
  reset_expires       bigint
);

create unique index if not exists users_email_unique on users (email);
create index if not exists users_reset_hash_idx on users (reset_hash) where reset_hash is not null;

-- Small key/value table for process-wide settings. The session signing secret
-- lives here so every instance signs and verifies the same cookies.
create table if not exists app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
